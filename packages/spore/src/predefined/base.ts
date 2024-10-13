import { ccc } from "@ckb-ccc/core";

export const COBUILD_INFO_HASH = ccc.hashCkb(
  ccc.bytesFrom("hello, cobuild", "utf8"),
);

export enum SporeScript {
  Spore = "spore",
  Cluster = "cluster",
}

export type ScriptInfo = Pick<ccc.Script, "codeHash" | "hashType"> & {
  cellDeps: ccc.CellDepInfoLike[];
  cobuild?: boolean;
};

export type SporeScriptInfo = Record<SporeScript, ScriptInfo>;
