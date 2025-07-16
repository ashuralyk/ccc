import { Address } from "../../address/index.js";
import { Script, Transaction, TransactionLike } from "../../ckb/index.js";
import { CellDepInfo, Client } from "../../client/index.js";
import { ScriptLike, WitnessArgs } from "../../index.js";
import { MultisigInfo, MultisigInfoLike } from "../../multisig/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

/**
 * A class extending Signer that provides access to a CKB multisig script.
 * This class does not support signing operations.
 * @public
 */
export class SignerCkbMultisigReadonly extends Signer {
  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.CkbMultisigSecp256k1;
  }

  public readonly multisigInfo: MultisigInfo;

  /**
   * Creates an instance of SignerCkbMultisig.
   *
   * @param client - The client instance used for communication.
   * @param privateKey - The private key associated with the signer.
   * @param multisigInfoLike - The multisig information assembled from pubkeys, threshold, mustMatch and since.
   */
  constructor(client: Client, multisigInfoLike: MultisigInfoLike) {
    super(client);

    this.multisigInfo = MultisigInfo.from(multisigInfoLike);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  async getAddressObjSecp256k1(): Promise<Address> {
    const multisigScript = await this.multisigInfo.defaultMultisigScript(
      this.client,
    );
    return Address.fromScript(multisigScript, this.client);
  }

  async getAddressObjs(): Promise<Address[]> {
    const multisigScripts = await this.multisigInfo.multisigScripts(
      this.client,
    );
    return multisigScripts.map((script) =>
      Address.fromScript(script, this.client),
    );
  }

  /**
   * Get related scripts from the transaction. Consider all of potential multisig scripts.
   *
   * @param txLike - The transaction to get related scripts from.
   * @returns A promise that resolves to an array of related scripts.
   */
  async getRelatedScripts(
    txLike: TransactionLike,
  ): Promise<{ script: Script; cellDeps: CellDepInfo[] }[]> {
    const tx = Transaction.from(txLike);
    const multisig = await this.getAddressObjs();

    const scripts: { script: Script; cellDeps: CellDepInfo[] }[] = [];
    for (const input of tx.inputs) {
      const {
        cellOutput: { lock },
      } = await input.getCell(this.client);

      if (scripts.some(({ script }) => script.eq(lock))) {
        continue;
      }

      if (multisig.some((address) => address.script.eq(lock))) {
        const scriptInfo = await this.client.findKnownScript(lock);
        if (scriptInfo) {
          scripts.push({
            script: lock,
            cellDeps: scriptInfo.cellDeps,
          });
        }
      }
    }

    return scripts;
  }

  /**
   * Prepare multisig witness, if the existence of multisig witness is detected, nothing happens
   *
   * @param txLike - The transaction to prepare.
   * @param scriptLike - The script to prepare.
   * @returns A promise that resolves to the prepared transaction
   */
  async prepareTxMultisigWitness(
    txLike: TransactionLike,
    scriptLike: ScriptLike,
  ) {
    const tx = Transaction.from(txLike);
    const position = await tx.findInputIndexByLock(scriptLike, this.client);
    if (position === undefined) {
      return;
    }

    const witness = tx.getWitnessArgsAt(position) ?? WitnessArgs.from({});
    witness.lock = this.multisigInfo.prepareWitnessLock(witness.lock ?? "");
    tx.setWitnessArgsAt(position, witness);
  }

  /**
   * Prepare transaction for multisig witness and adding related cell deps
   *
   * @param txLike - The transaction to prepare.
   * @returns A promise that resolves to the prepared transaction
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);

    await Promise.all(
      (await this.getRelatedScripts(tx)).map(async ({ script, cellDeps }) => {
        await this.prepareTxMultisigWitness(tx, script);
        await tx.addCellDepInfos(this.client, cellDeps);
      }),
    );
    return tx;
  }

  /**
   * Check if the multisig witness is fulfilled
   *
   * @param txLike - The transaction to check.
   * @param restrict - If true, throw an error if the multisig script is not found in Inputs.
   * @returns A promise that resolves to true if the multisig witness is fulfilled, false otherwise.
   */
  async signaturesFulfilled(
    txLike: TransactionLike,
    restrict: boolean = false,
  ): Promise<boolean> {
    const tx = Transaction.from(txLike);

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (index === undefined) {
        if (restrict) {
          throw new Error("Multisig script not found in Inputs");
        }
        return false;
      }

      const witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock) {
        return false;
      }

      if (!this.multisigInfo.checkSignaturesFulfilled(witness.lock, restrict)) {
        return false;
      }
    }

    return true;
  }
}
