import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import "dotenv/config";
import { describe, expect, it } from "vitest";
import { FeePayerFromSporeMargin } from "../feePayer/feePayerFromSporeMargin.js";
import { transferSpore } from "../index.js";

describe("transferSpore [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should transfer a Spore cell by sporeId with zero fee", async () => {
    const client = new ccc.ClientPublicTestnet();
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Create a new owner
    const owner = await ccc.Address.fromString(
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqv5puz2ee96nuh9nmc6rtm0n8v7agju4rgdmxlnk",
      signer.client,
    );

    // Build transaction
    let { tx } = await transferSpore({
      signer,
      // Change this if you have a different sporeId
      id: "0x37c3060ea1e6ddea4e8d5d306a3a6929ff5b63e1ea727f8fea881a04ab457a6e",
      to: owner.script,
    });

    // Complete transaction
    const marginPayer = new FeePayerFromSporeMargin();
    await tx.completeByFeePayer(client, marginPayer, signer);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    const txHash = await signer.client.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
