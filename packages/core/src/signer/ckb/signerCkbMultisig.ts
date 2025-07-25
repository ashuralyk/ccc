import { Transaction, TransactionLike } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import { hexConcat, hexFrom, HexLike } from "../../hex/index.js";
import { MultisigInfoLike } from "../../multisig/index.js";
import { SignerCkbMultisigReadonly } from "./signerCkbMultisigReadonly.js";
import { SignerCkbPrivateKey } from "./signerCkbPrivateKey.js";

/**
 * A class extending Signer that provides access to a CKB multisig script and supports signing operations.
 * @public
 */
export class SignerCkbMultisig extends SignerCkbMultisigReadonly {
  public readonly signer: SignerCkbPrivateKey;

  constructor(
    client: Client,
    privateKey: HexLike,
    multisigInfoLike: MultisigInfoLike,
  ) {
    super(client, multisigInfoLike);
    this.signer = new SignerCkbPrivateKey(client, privateKey);

    if (!this.multisigInfo.containPubkey(this.signer.publicKey)) {
      throw new Error("Private key is not in the multisig info");
    }
  }

  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let lastIndex = -1;
    const tx = Transaction.from(txLike);
    const emptySignature = hexFrom(new Uint8Array(65).fill(0));

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (index === undefined) {
        return tx;
      }
      if (index === lastIndex) {
        continue;
      } else {
        lastIndex = index;
      }

      const witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock) {
        throw new Error("Multisig witness not prepared");
      }

      // Empty multisig witness for current signing
      const rawWitnessLock = witness.lock;
      witness.lock = hexConcat(
        this.multisigInfo.metadata.toBytes(),
        ...Array.from(
          new Array(this.multisigInfo.metadata.threshold),
          () => emptySignature,
        ),
      );
      tx.setWitnessArgsAt(index, witness);
      const info = await tx.getSignHashInfo(script, this.client);
      if (!info) {
        continue;
      }
      const signature = await this.signer._signMessage(info.message);

      witness.lock = this.multisigInfo.insertSignature(
        rawWitnessLock,
        signature,
      );
      tx.setWitnessArgsAt(index, witness);
    }

    return tx;
  }
}
