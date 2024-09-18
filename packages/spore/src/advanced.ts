import { ccc } from "@ckb-ccc/core";
import { BytesLike, UnpackResult, molecule } from "@ckb-lumos/codec";
import { bytify } from "@ckb-lumos/codec/lib/bytes.js";
import {
  Action,
  ActionVec,
  SporeAction,
  WitnessLayout,
} from "./codec/index.js";
import {
  COBUILD_INFO_HASH,
  SporeScript,
  SporeScriptInfo,
  buildSporeScript,
} from "./predefined.js";

/**
 * The codec for packing/unpacking UTF-8 raw strings.
 * Should be packed like so: String.pack('something')
 */
export const RawString = molecule.byteVecOf({
  pack: (packable: string) => ccc.bytesFrom(packable, "utf8"),
  unpack: (unpackable: BytesLike) => ccc.bytesTo(bytify(unpackable), "utf8"),
});

export async function findClusterById(
  client: ccc.Client,
  id: ccc.HexLike,
  scriptInfo?: SporeScriptInfo,
): Promise<ccc.Cell> {
  const type = buildSporeScript(client, SporeScript.Cluster, id, scriptInfo);
  const cell = await client.findSingletonCellByType(type, true);
  if (!cell) {
    throw new Error("Cluster not found for clusterId: " + id);
  }

  return cell;
}

export function assembleCreateSporeAction(
  sporeOutput: ccc.CellOutputLike,
  sporeData: ccc.BytesLike,
): UnpackResult<typeof Action> {
  if (!sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "CreateSpore",
    value: {
      sporeId: sporeType.args,
      dataHash: ccc.hashCkb(sporeData),
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: COBUILD_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleTransferSporeAction(
  sporeInput: ccc.CellOutputLike,
  sporeOutput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!sporeInput.type || !sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "TransferSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: COBUILD_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleMeltSporeAction(
  sporeInput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!sporeInput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeInput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "MeltSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
    },
  });
  return {
    scriptInfoHash: COBUILD_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleCreateClusterAction(
  clusterOutput: ccc.CellOutputLike,
  clusterData: ccc.BytesLike,
): UnpackResult<typeof Action> {
  if (!clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "CreateCluster",
    value: {
      clusterId: clusterType.args,
      dataHash: ccc.hashCkb(clusterData),
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: COBUILD_INFO_HASH,
    scriptHash: clusterTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleTransferClusterAction(
  clusterInput: ccc.CellOutputLike,
  clusterOutput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!clusterInput.type || !clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "TransferCluster",
    value: {
      clusterId: clusterType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(clusterInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: COBUILD_INFO_HASH,
    scriptHash: clusterTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function injectCommonCobuildProof(
  tx: ccc.TransactionLike,
  actions: UnpackResult<typeof ActionVec>,
): ccc.Transaction {
  const witnessLayout = ccc.hexFrom(
    WitnessLayout.pack({
      type: "SighashAll",
      value: {
        seal: "0x",
        message: {
          actions,
        },
      },
    }),
  );
  const txSkeleton = ccc.Transaction.from(tx);
  txSkeleton.witnesses.push(ccc.hexFrom(witnessLayout));
  return txSkeleton;
}