/**
 * The shape of a stored response body and of the codec that produces it.
 * Hosts implement the codec, since compression needs host APIs such as
 * `node:zlib`, so the cache policy and stores stay portable.
 */

/** How an entry's body bytes are encoded. */
export type BodyEncoding = "zstd" | "br" | "identity";

/** A body as stored: its bytes plus what is needed to decode them. */
export type EncodedBody = {
  bytes: Uint8Array;
  encoding: BodyEncoding;
  /**
   * Compression dictionary the bytes need. Never set today; recorded so a
   * later dictionary rollout can tell its entries apart from plain ones.
   */
  dictId?: string;
  /** Size of the original body, which bounds decompression. */
  rawSize: number;
};

/** Encodes and decodes cached bodies. */
export type BodyCodec = {
  /** Compress a body for storage. */
  encode(raw: Uint8Array): Promise<EncodedBody>;
  /**
   * Restore a stored body. Returns `undefined` when this runtime cannot read
   * the entry (zstd on Node < 22.15, or a dictionary it does not have), so the
   * caller treats it as a miss. Throws when the bytes are corrupt or do not
   * decode to `rawSize` bytes.
   */
  decode(body: EncodedBody): Promise<Uint8Array | undefined>;
};
