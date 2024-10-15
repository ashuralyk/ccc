import { ccc } from "@ckb-ccc/core";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferClusterAction,
  assembleTransferSporeAction,
  prepareSporeTransaction,
} from "../advanced.js";
import { SporeData, packRawSporeData } from "../codec/index.js";
import {
  computeTypeId,
  injectOneCapacityCell,
  searchOneCellByLock,
} from "../helper.js";
import {
  SporeScript,
  SporeVersion,
  buildSporeCellDep,
  buildSporeScript,
  cobuildRequired,
  findExistedSporeCellAndCelldep,
} from "../predefined/index.js";

/**
 * Create one or more Spore cells with the specified Spore data.
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param spores specific format of data required by Spore protocol with its owner, which will be replaced with signer if no provided
 * @param clusterMode how to process cluster cell **(if clusterId is not provided in SporeData, this parameter will be ignored)**
 *   - lockProxy: put a cell that uses the same lock from Cluster cell in both Inputs and Outputs
 *   - clusterCell: directly put Cluster cell in Inputs and Outputs
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **tx**: a new transaction that contains created Spore cells
 *  - **ids**: the sporeId of each created Spore cell
 */
export async function createSpores(params: {
  signer: ccc.Signer;
  spores: {
    data: SporeData;
    to?: ccc.ScriptLike;
  }[];
  clusterMode?: "lockProxy" | "clusterCell";
  version?: SporeVersion;
  tx?: ccc.TransactionLike;
}): Promise<{
  tx: ccc.Transaction;
  ids: ccc.Hex[];
}> {
  const { signer, spores, clusterMode, version } = params;

  // prepare transaction
  const actions = [];
  const ids: ccc.Hex[] = [];
  const tx = ccc.Transaction.from(params.tx ?? {});
  if (tx.inputs.length === 0) {
    await injectOneCapacityCell(signer, tx);
  }

  const { script: lock } = await signer.getRecommendedAddressObj();

  // build spore cell
  const processedCluster: ccc.Hex[] = [];
  for (const { data, to } of spores) {
    const id = computeTypeId(tx, tx.outputs.length);
    ids.push(id);

    const type = buildSporeScript(
      signer.client,
      SporeScript.Spore,
      id,
      version,
    );
    const packedData = packRawSporeData(data);
    tx.addOutput(
      {
        lock: to ?? lock,
        type,
      },
      packedData,
    );

    // create spore action
    const output = tx.outputs[tx.outputs.length - 1];
    const createAction = assembleCreateSporeAction(output, packedData);
    actions.push(createAction);

    // skip if the spore is not belong to a cluster or it has been processed
    if (
      !clusterMode ||
      !data.clusterId ||
      processedCluster.includes(ccc.hexFrom(data.clusterId))
    ) {
      continue;
    }
    processedCluster.push(ccc.hexFrom(data.clusterId));

    const { cell: cluster, celldep: clusterCelldep } =
      await findExistedSporeCellAndCelldep(
        signer.client,
        SporeScript.Cluster,
        data.clusterId,
      );
    switch (clusterMode) {
      case "lockProxy": {
        const clusterLock = cluster.cellOutput.lock;
        const lockProxyInputIndex = await tx.findInputIndexByLock(
          clusterLock,
          signer.client,
        );
        if (!lockProxyInputIndex) {
          const clusterLockProxyCell = await searchOneCellByLock(signer);
          if (!clusterLockProxyCell) {
            throw new Error("Cluster lock proxy cell not found");
          }
          tx.inputs.push(
            ccc.CellInput.from({
              previousOutput: clusterLockProxyCell.outPoint,
              ...clusterLockProxyCell,
            }),
          );
        }
        const lockProxyOutputIndex = tx.outputs.findIndex(
          (output) => output.lock === clusterLock,
        );
        if (lockProxyOutputIndex === -1) {
          tx.addOutput({
            lock: clusterLock,
          });
        }
        tx.addCellDeps({
          outPoint: cluster.outPoint,
          depType: "code",
        });
        break;
      }
      case "clusterCell": {
        tx.inputs.push(
          ccc.CellInput.from({
            previousOutput: cluster.outPoint,
            ...cluster,
          }),
        );
        tx.addOutput(cluster.cellOutput, cluster.outputData);
        // note: add cluster as celldep, which will be used in Spore contract
        tx.addCellDeps({
          outPoint: cluster.outPoint,
          depType: "code",
        });
        await tx.addCellDepInfos(signer.client, clusterCelldep);
        const transferCluster = assembleTransferClusterAction(
          cluster.cellOutput,
          cluster.cellOutput,
        );
        actions.push(transferCluster);
        break;
      }
    }
  }

  // complete celldeps and cobuild actions
  await tx.addCellDepInfos(
    signer.client,
    await buildSporeCellDep(signer.client, SporeScript.Spore, version),
  );

  return {
    tx: await (cobuildRequired(tx)
      ? prepareSporeTransaction(signer, tx, actions)
      : signer.prepareTransaction(tx)),
    ids,
  };
}

/**
 * Transfer one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param spores sporeId with its new owner
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **tx**: a new transaction that contains transferred Spore cells
 */
export async function transferSpores(params: {
  signer: ccc.Signer;
  spores: {
    id: ccc.HexLike;
    to: ccc.ScriptLike;
  }[];
  tx?: ccc.TransactionLike;
}): Promise<{
  tx: ccc.Transaction;
}> {
  const { signer, spores } = params;

  // prepare transaction
  const actions = [];
  const tx = ccc.Transaction.from(params.tx ?? {});

  // build spore cell
  let celldeps: Set<ccc.CellDepInfo> = new Set();
  for (const { id, to } of spores) {
    const { cell: sporeCell, celldep } = await findExistedSporeCellAndCelldep(
      signer.client,
      SporeScript.Spore,
      id,
    );
    celldep.forEach((value) => celldeps.add(value));
    tx.inputs.push(
      ccc.CellInput.from({
        previousOutput: sporeCell.outPoint,
        ...sporeCell,
      }),
    );
    tx.addOutput(
      {
        lock: to,
        type: sporeCell.cellOutput.type,
      },
      sporeCell.outputData,
    );

    const sporeOutput = tx.outputs[tx.outputs.length - 1];
    const transferSpore = assembleTransferSporeAction(
      sporeCell.cellOutput,
      sporeOutput,
    );
    actions.push(transferSpore);
  }

  // complete cellDeps and cobuild actions
  await tx.addCellDepInfos(signer.client, [...celldeps]);
  return {
    tx: await (cobuildRequired(tx)
      ? prepareSporeTransaction(signer, tx, actions)
      : signer.prepareTransaction(tx)),
  };
}

/**
 * Melt one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeIds collection of sporeId to be melted
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains melted Spore cells
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 */
export async function meltSpores(params: {
  signer: ccc.Signer;
  ids: ccc.HexLike[];
  tx?: ccc.TransactionLike;
}): Promise<{
  tx: ccc.Transaction;
}> {
  const { signer, ids } = params;

  // prepare transaction
  const actions = [];
  const tx = ccc.Transaction.from(params.tx ?? {});

  // build spore cell
  let celldeps: Set<ccc.CellDepInfo> = new Set();
  for (const sporeId of ids) {
    const { cell: sporeCell, celldep } = await findExistedSporeCellAndCelldep(
      signer.client,
      SporeScript.Spore,
      sporeId,
    );
    celldep.forEach((value) => celldeps.add(value));
    tx.inputs.push(
      ccc.CellInput.from({
        previousOutput: sporeCell.outPoint,
        ...sporeCell,
      }),
    );

    const meltSpore = assembleMeltSporeAction(sporeCell.cellOutput);
    actions.push(meltSpore);
  }

  // complete cell deps cobuild actions
  await tx.addCellDepInfos(signer.client, [...celldeps]);

  return {
    tx: await (cobuildRequired(tx)
      ? prepareSporeTransaction(signer, tx, actions)
      : signer.prepareTransaction(tx)),
  };
}
