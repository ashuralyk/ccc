import { ccc } from "@ckb-ccc/core";

export async function searchOneCellByLock(
  signer: ccc.Signer,
): Promise<ccc.Cell | undefined> {
  for await (const cell of signer.findCells(
    {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    },
    true,
    undefined,
    1,
  )) {
    return cell;
  }
}

export async function injectOneCapacityCell(
  signer: ccc.Signer,
  tx: ccc.Transaction,
): Promise<void> {
  const liveCell = await searchOneCellByLock(signer);
  if (!liveCell) {
    throw new Error("No live cell found");
  }

  tx.inputs.push(
    ccc.CellInput.from({
      previousOutput: liveCell.outPoint,
      ...liveCell,
    }),
  );
}

export function computeTypeId(
  txLike: ccc.TransactionLike,
  outputIndex: ccc.NumLike,
): ccc.Hex {
  const tx = ccc.Transaction.from(txLike);

  if (tx.inputs.length === 0) {
    throw new Error("No input found in transaction");
  }
  return ccc.hashTypeId(tx.inputs[0], outputIndex);
}
