import { ccc } from "@ckb-ccc/core";
import { ScriptInfo, SporeScript, SporeScriptInfo } from "./base.js";
import * as did from "./did.js";
import * as sporeV1 from "./sporeV1.js";
import * as sporeV2 from "./sporeV2.js";
export * from "./base.js";

const SPORE_MAINNET_SCRIPTS_COLLECTION = [
  sporeV2.SPORE_MAINNET_SCRIPTS,
  did.DID_MAINNET_SCRIPTS,
];

const SPORE_TESTNET_SCRIPTS_COLLECTION = [
  sporeV1.SPORE_TESTNET_SCRIPTS,
  sporeV2.SPORE_TESTNET_SCRIPTS,
  did.DID_TESTNET_SCRIPTS,
];

function getScriptInfoByCodeHash(
  codeHash: ccc.HexLike,
): ScriptInfo | undefined {
  for (const scriptInfo of SPORE_MAINNET_SCRIPTS_COLLECTION) {
    for (const info of Object.values(scriptInfo)) {
      if (info.codeHash === codeHash) {
        return info;
      }
    }
  }
  for (const scriptInfo of SPORE_TESTNET_SCRIPTS_COLLECTION) {
    for (const info of Object.values(scriptInfo)) {
      if (info.codeHash === codeHash) {
        return info;
      }
    }
  }
}

export async function findExistedSporeCellAndCellDep(
  client: ccc.Client,
  protocol: SporeScript,
  args: ccc.HexLike,
  scriptInfo?: SporeScriptInfo,
): Promise<{
  cell: ccc.Cell;
  cellDep: ccc.CellDep[];
}> {
  if (scriptInfo) {
    const script = buildSporeScript(client, protocol, args, scriptInfo);
    const cell = await client.findSingletonCellByType(script, true);
    if (cell) {
      return {
        cell,
        cellDep: await buildSporeCellDep(client, protocol, scriptInfo),
      };
    }
    throw new Error(
      `${protocol} cell not found of args ${args} from specified scriptInfo`,
    );
  }
  for (const scriptInfo of client.addressPrefix === "ckb"
    ? SPORE_MAINNET_SCRIPTS_COLLECTION
    : SPORE_TESTNET_SCRIPTS_COLLECTION) {
    const info = scriptInfo[protocol];
    const script = ccc.Script.from({
      args,
      ...info,
    });
    const cell = await client.findSingletonCellByType(script, true);
    if (cell) {
      return {
        cell,
        cellDep: await buildSporeCellDep(client, protocol, scriptInfo),
      };
    }
  }
  throw new Error(`${protocol} cell not found of args: ${args}`);
}

export function buildSporeScript(
  client: ccc.Client,
  protocol: SporeScript,
  args: ccc.HexLike,
  scriptInfo?: SporeScriptInfo,
): ccc.Script {
  const collection =
    scriptInfo ??
    (client.addressPrefix === "ckb"
      ? sporeV2.SPORE_MAINNET_SCRIPTS
      : sporeV2.SPORE_TESTNET_SCRIPTS);

  return ccc.Script.from({
    args,
    ...collection[protocol],
  });
}

export async function buildSporeCellDep(
  client: ccc.Client,
  protocol: SporeScript,
  scriptInfo?: SporeScriptInfo,
): Promise<ccc.CellDep[]> {
  const info =
    scriptInfo ??
    (client.addressPrefix === "ckb"
      ? sporeV2.SPORE_MAINNET_SCRIPTS
      : sporeV2.SPORE_TESTNET_SCRIPTS);

  const config = info[protocol];
  return client.getCellDeps(config.cellDeps);
}

export async function cobuildRequired(
  client: ccc.Client,
  txLike: ccc.TransactionLike,
): Promise<boolean> {
  const tx = ccc.Transaction.from(txLike);

  const checkCodeHash = (codeHash: ccc.HexLike | undefined) => {
    if (!codeHash) {
      return false;
    }
    const scriptInfo = getScriptInfoByCodeHash(codeHash);
    if (!scriptInfo) {
      return false;
    }
    return scriptInfo.cobuild ?? false;
  };

  for (const input of tx.inputs) {
    await input.completeExtraInfos(client);
    if (checkCodeHash(input.cellOutput?.type?.codeHash)) {
      return true;
    }
  }
  return tx.outputs.some((output) => checkCodeHash(output.type?.codeHash));
}
