import { ccc } from "@ckb-ccc/core";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  getClusterScriptInfos,
  getSporeScriptInfos,
} from "../predefined/index.js";

export const ONE_CKB = ccc.numFrom(10 ** 8);

export async function findSingletonCellByArgs(
  client: ccc.Client,
  args: ccc.HexLike,
  scripts: (SporeScriptInfoLike | undefined)[],
): Promise<
  | {
      cell: ccc.Cell;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  for (const scriptInfo of scripts) {
    if (!scriptInfo) {
      continue;
    }

    const cell = await client.findSingletonCellByType(
      {
        ...scriptInfo,
        args,
      },
      true,
    );

    if (cell) {
      return {
        cell,
        scriptInfo: SporeScriptInfo.from(scriptInfo),
      };
    }
  }
}

export function isSporeScript(
  scriptLike: ccc.ScriptLike,
  client: ccc.Client,
): boolean {
  const script = ccc.Script.from(scriptLike);
  return Object.values(getSporeScriptInfos(client)).some(
    (scriptInfo) => script.codeHash === scriptInfo?.codeHash,
  );
}

export function isSporeCell(
  cellOutputLike: ccc.CellOutputLike,
  client: ccc.Client,
): boolean {
  const output = ccc.CellOutput.from(cellOutputLike);
  if (output.type === undefined) {
    return false;
  }
  return isSporeScript(output.type, client);
}

export function isClusterScript(
  scriptLike: ccc.ScriptLike,
  client: ccc.Client,
): boolean {
  const script = ccc.Script.from(scriptLike);
  return Object.values(getClusterScriptInfos(client)).some(
    (scriptInfo) => script.codeHash === scriptInfo?.codeHash,
  );
}

export function isClusterCell(
  cellOutputLike: ccc.CellOutputLike,
  client: ccc.Client,
): boolean {
  const output = ccc.CellOutput.from(cellOutputLike);
  if (output.type === undefined) {
    return false;
  }
  return isClusterScript(output.type, client);
}
