import { ccc } from "@ckb-ccc/core";
import { isSporeCell } from "../helper/index.js";

export class FeePayerFromSporeMargin extends ccc.FeePayer {
  async completeTxFee(
    tx: ccc.Transaction,
    client: ccc.Client,
    options?: ccc.FeeRateOptions,
  ): Promise<void> {
    const feeRate = await ccc.FeePayer.getFeeRate(client, options);

    const neededFee = tx.estimateFee(feeRate);
    const providedFee = await tx.getFee(client);

    if (providedFee >= neededFee) {
      return;
    }

    let feeFromMargin = neededFee - providedFee;
    for (const [i, output] of tx.outputs.entries()) {
      if (!isSporeCell(output, client)) {
        continue;
      }
      const margin = tx.getOutputCapacityMargin(i);
      console.log("spore cell found", margin, feeFromMargin);
      if (margin < feeFromMargin) {
        feeFromMargin -= margin;
        tx.outputs[i].capacity -= margin;
      } else {
        tx.outputs[i].capacity -= feeFromMargin;
        feeFromMargin = ccc.Zero;
        break;
      }
    }

    if (feeFromMargin > 0) {
      throw new Error("Insufficient capacity for paying fee from Spore margin");
    }
  }
}
