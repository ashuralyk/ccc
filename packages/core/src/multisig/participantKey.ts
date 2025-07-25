import { Hex, hexFrom, HexLike } from "../hex/index.js";

export enum Algorithm {
  Secp256k1,
  /**
   * Used for FIPS 205-2 quantum-resistant lock script.
   * @see https://github.com/xxuejie/quantum-resistant-lock-script/blob/bf2ab2a7a01a21c48d1151e0c488c66e0e4199c9/crates/ckb-fips205-utils/src/lib.rs#L33-L58
   */
  Sha2128F,
  Sha2128S,
  Sha2192F,
  Sha2192S,
  Sha2256F,
  Sha2256S,
  Shake128F,
  Shake128S,
  Shake192F,
  Shake192S,
  Shake256F,
  Shake256S,
  /**
   * Used for arbitrary algorithm provided by leaf scripts. (leveraged by features like `spawn` and `exec`)
   */
  Unknown,
}

export type ParticipantKeyLike = {
  pubkey: HexLike;
  algorithm?: Algorithm;
};

/**
 * A class representing a participant key, holding information ingredients and containing utilities.
 * @public
 */
export class ParticipantKey {
  public readonly pubkey: Hex;
  public readonly algorithm: Algorithm;

  private constructor(participantKeyLike: ParticipantKeyLike) {
    this.pubkey = hexFrom(participantKeyLike.pubkey);
    this.algorithm = participantKeyLike.algorithm ?? Algorithm.Secp256k1;
  }

  static from(participantKeyLike: ParticipantKeyLike): ParticipantKey {
    return new ParticipantKey(participantKeyLike);
  }

  static fromSecp256k1Pubkey(pubkey: HexLike): ParticipantKey {
    return new ParticipantKey({ pubkey });
  }
}

/**
 * A dictionary mapping algorithm to its corresponding ID.
 * @see https://github.com/xxuejie/rfcs/blob/multisig/rfcs/0000-arbitrary-multisig/0000-arbitrary-multisig.md#algo_id
 */
export const ALGORITHM_ID_DICT: Record<Algorithm, Array<number>> = {
  [Algorithm.Secp256k1]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  [Algorithm.Sha2128F]: [48],
  [Algorithm.Sha2128S]: [49],
  [Algorithm.Sha2192F]: [50],
  [Algorithm.Sha2192S]: [51],
  [Algorithm.Sha2256F]: [52],
  [Algorithm.Sha2256S]: [53],
  [Algorithm.Shake128F]: [54],
  [Algorithm.Shake128S]: [55],
  [Algorithm.Shake192F]: [56],
  [Algorithm.Shake192S]: [57],
  [Algorithm.Shake256F]: [58],
  [Algorithm.Shake256S]: [59],
  /**
   * 60 - 62 are reserved for FIPS 204.
   */
  [Algorithm.Unknown]: [63],
};
