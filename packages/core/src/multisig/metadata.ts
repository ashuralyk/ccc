import { Hex, hexConcat, hexFrom } from "../hex/index.js";
import { bytesFrom, BytesLike, hashCkb, numToBytes } from "../index.js";
import { ParticipantKey, ParticipantKeyLike } from "./participantKey.js";

export enum MetadataVersion {
  Multisig = 0x00,
  ArbitraryMultisig = 0x80,
}

export type MetadataLike = {
  version?: MetadataVersion;
  keys: Array<ParticipantKeyLike>;
  threshold: number;
  mustMatch: number;
};

export class Metadata {
  public version: MetadataVersion;
  public keys: ParticipantKey[];
  public threshold: number;
  public mustMatch: number;

  private constructor(metadata: MetadataLike) {
    this.version = metadata.version ?? MetadataVersion.Multisig;
    this.keys = metadata.keys.map(ParticipantKey.from);
    this.threshold = metadata.threshold;
    this.mustMatch = metadata.mustMatch;

    if (this.threshold < 0 || this.threshold > 255) {
      throw new Error("`threshold` must be positive and less than 256!");
    }
    if (this.mustMatch < 0 || this.mustMatch > 255) {
      throw new Error("`mustMatch` must be positive and less than 256!");
    }
    if (this.mustMatch > this.threshold) {
      throw new Error("`mustMatch` must be less than or equal to `threshold`!");
    }
    if (
      this.keys.length < this.mustMatch ||
      this.keys.length < this.threshold ||
      this.keys.length > 255
    ) {
      throw new Error(
        "length of `pubkeys` must be greater than or equal to `mustMatch` and `threshold` and less than 256!",
      );
    }
  }

  static from(metadata: MetadataLike): Metadata {
    return new Metadata(metadata);
  }

  static fromBytes(witnessLockLike: BytesLike): Metadata {
    const bytes = Array.from(bytesFrom(witnessLockLike));
    const version = bytes[0] as MetadataVersion;
    if (
      version !== MetadataVersion.Multisig &&
      version !== MetadataVersion.ArbitraryMultisig
    ) {
      throw new Error("Please check your metadata version!");
    }
    switch (version) {
      case MetadataVersion.Multisig: {
        const pkLen = 20;
        const mustMatch = bytes[1];
        const threshold = bytes[2];
        const pubkeyCount = bytes[3];
        if (pubkeyCount * pkLen !== bytes.length - 4) {
          throw new Error("Invalid metadata bytes!");
        }
        const pubkeyBlake160Hashes: Hex[] = [];
        for (let i = 0; i < pubkeyCount; i++) {
          const start = 4 + i * pkLen;
          const end = start + pkLen;
          pubkeyBlake160Hashes.push(hexFrom(bytes.slice(start, end)));
        }
        return new Metadata({
          version,
          keys: pubkeyBlake160Hashes.map((hash) => ({ pubkey: hash })),
          mustMatch,
          threshold,
        });
      }
      case MetadataVersion.ArbitraryMultisig: {
        // TODO: Implement arbitrary multisig metadata
        throw new Error("Not implemented");
      }
    }
  }

  toBytes(): Hex {
    const pubkeyBlake160Hashes = this.keys.map(
      (key) => hashCkb(hexFrom(key.pubkey)).slice(0, 42) as Hex,
    );
    switch (this.version) {
      case MetadataVersion.Multisig:
        return hexConcat(
          hexFrom(numToBytes(this.version)),
          hexFrom(numToBytes(this.mustMatch)),
          hexFrom(numToBytes(this.threshold)),
          hexFrom(numToBytes(pubkeyBlake160Hashes.length)),
          ...pubkeyBlake160Hashes,
        );
      case MetadataVersion.ArbitraryMultisig:
        // TODO: Implement arbitrary multisig metadata
        throw new Error("Not implemented");
    }
  }
}
