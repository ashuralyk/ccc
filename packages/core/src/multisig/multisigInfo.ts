import { Script, Since, SinceLike } from "../ckb/index.js";
import { Client, KnownScript } from "../client/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex, hexConcat, hexFrom, HexLike } from "../hex/index.js";
import { Metadata, MetadataVersion } from "./metadata.js";
import { Algorithm, ParticipantKeyLike } from "./participantKey.js";

export const MULTISIG_SCRIPT_DEFAULT = KnownScript.Secp256k1MultisigV2;
export const MULTISIG_SCRIPTS = [
  KnownScript.Secp256k1MultisigV2,
  KnownScript.Secp256k1Multisig,
];

export type MultisigInfoLike = {
  keys: Array<ParticipantKeyLike>;
  threshold: number;
  mustMatch: number;
  since?: SinceLike;
  multisigScript?:
    | KnownScript.Secp256k1Multisig
    | KnownScript.Secp256k1MultisigV2;
};

/**
 * A class representing multisig information, holding information ingredients and containing utilities.
 * @public
 */
export class MultisigInfo {
  public readonly metadata: Metadata;
  public readonly since?: Since;
  public readonly knownMultisigScript:
    | KnownScript.Secp256k1Multisig
    | KnownScript.Secp256k1MultisigV2;

  private constructor(multisig: MultisigInfoLike) {
    this.metadata = Metadata.from({
      keys: multisig.keys,
      threshold: multisig.threshold,
      mustMatch: multisig.mustMatch,
    });
    this.since = multisig.since ? Since.from(multisig.since) : undefined;
    this.knownMultisigScript =
      multisig.multisigScript ?? MULTISIG_SCRIPT_DEFAULT;
    if (this.knownMultisigScript !== MULTISIG_SCRIPT_DEFAULT) {
      console.warn(
        `Multisig script '${this.knownMultisigScript}' is marked as **Deprecated**, please using '${MULTISIG_SCRIPT_DEFAULT}' instead`,
      );
    }
  }

  static from(multisig: MultisigInfoLike): MultisigInfo {
    return new MultisigInfo(multisig);
  }

  containPubkey(pubkeyLike: HexLike): boolean {
    return this.metadata.keys.some((key) => key.pubkey === pubkeyLike);
  }

  multisigScriptArgs(): Hex {
    const metadataBlake160Hash = hashCkb(this.metadata.toBytes()).slice(
      0,
      42,
    ) as Hex;
    if (this.since) {
      const sinceBytes = this.since.toBytes();
      return hexConcat(metadataBlake160Hash, hexFrom(sinceBytes));
    } else {
      return metadataBlake160Hash;
    }
  }

  async defaultMultisigScript(client: Client): Promise<Script> {
    return await Script.fromKnownScript(
      client,
      this.knownMultisigScript,
      this.multisigScriptArgs(),
    );
  }

  async multisigScripts(client: Client): Promise<Script[]> {
    const args = this.multisigScriptArgs();
    return await Promise.all(
      MULTISIG_SCRIPTS.map(async (script) => {
        return await Script.fromKnownScript(client, script, args);
      }),
    );
  }

  prepareWitnessLock(witnessLockLike: HexLike): Hex {
    switch (this.metadata.version) {
      case MetadataVersion.Multisig: {
        // Prepare signature placeholder
        const emptySignature = hexFrom(Array.from(new Array(65), () => 0));
        const signaturePlaceholder = hexConcat(
          ...Array.from(
            new Array(this.metadata.threshold),
            () => emptySignature,
          ),
        );

        // Check if the multisig witness is already prepared
        const witnessLock = hexFrom(witnessLockLike);
        const metadataBytes = this.metadata.toBytes();
        if (
          witnessLock.startsWith(metadataBytes) &&
          witnessLock.length ===
            metadataBytes.length + signaturePlaceholder.slice(2).length
        ) {
          return witnessLock;
        }

        // Reset multisig witness to signature placeholder
        return hexConcat(metadataBytes, signaturePlaceholder);
      }
      case MetadataVersion.ArbitraryMultisig: {
        throw new Error("Not implemented");
      }
    }
  }

  checkSignaturesFulfilled(
    witnessLockLike: HexLike,
    restrict: boolean = false,
  ): boolean {
    const witnessLock = hexFrom(witnessLockLike);
    const metadataBytes = this.metadata.toBytes();

    switch (this.metadata.version) {
      case MetadataVersion.Multisig: {
        const emptySignature = hexFrom(Array.from(new Array(65), () => 0));
        if (!witnessLock.startsWith(metadataBytes)) {
          return false;
        }

        const signatures =
          witnessLock
            .slice(metadataBytes.length)
            .match(/.{1,130}/g)
            ?.map(hexFrom) || [];
        if (signatures.length !== this.metadata.threshold) {
          if (restrict) {
            throw new Error(
              `Not enough signatures to threshold (${signatures.length}/${this.metadata.threshold})`,
            );
          }
          return false;
        }

        if (
          signatures.filter((sig) => sig !== emptySignature).length <
          this.metadata.threshold
        ) {
          return false;
        }

        break;
      }
      case MetadataVersion.ArbitraryMultisig: {
        throw new Error("Not implemented");
      }
    }
    return true;
  }

  insertSignature(
    witnessLockLike: HexLike,
    signature: HexLike,
    algorithm: Algorithm = Algorithm.Secp256k1,
  ): Hex {
    const witnessLock = hexFrom(witnessLockLike);
    const metadataBytes = this.metadata.toBytes();

    switch (this.metadata.version) {
      case MetadataVersion.Multisig: {
        if (algorithm !== Algorithm.Secp256k1) {
          throw new Error("Only secp256k1 is supported for multisig");
        }

        // Signatures array is placed after the multisig metadata, in 65 bytes per signature
        const emptySignature = hexFrom(Array.from(new Array(65), () => 0));
        const signatures =
          witnessLock
            .slice(metadataBytes.length)
            .match(/.{1,130}/g)
            ?.map(hexFrom) || [];
        const insertIndex = signatures.findIndex(
          (sig) => sig === emptySignature,
        );
        if (signatures.length !== this.metadata.threshold) {
          throw new Error(
            `Not enough signature slots to threshold (${signatures.length}/${this.metadata.threshold})`,
          );
        }
        if (insertIndex === -1) {
          // Signatures have been filled
          return witnessLock;
        }
        signatures[insertIndex] = hexFrom(signature);

        // Empty multisig witness for current signing
        return hexConcat(metadataBytes, ...signatures);
      }
      case MetadataVersion.ArbitraryMultisig: {
        throw new Error("Not implemented");
      }
    }
  }
}
