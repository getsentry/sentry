/**
 * Storage interface for cached Sentry API responses. Backends (memory, the
 * CLI's filesystem, R2) store entries whose bodies are already encoded by
 * the host's `BodyCodec`, and each enforces its own byte budget.
 */

import type { EncodedBody } from "./body.js";
import type { TtlTier } from "./tiers.js";

/** A cached response as a store holds it. */
export type CacheEntry = {
  /** Full request URL, matched by {@link CacheStore.deleteMatching}. */
  url: string;
  /** Hash of the login that owns the entry; never a raw token. */
  identity: string;
  /** Fallback tier the URL was classified into. */
  tier: TtlTier;
  /** HTTP status of the cached response. */
  status: number;
  /** Response headers kept for callers, such as `Link` for pagination. */
  headers: Readonly<Record<string, string>>;
  /** The response body, encoded by the codec. */
  body: EncodedBody;
  /**
   * The serialized `http-cache-semantics` policy. Stores keep it as is and
   * never read it; `lookupResponse` uses it to decide freshness and
   * revalidation.
   */
  policy: unknown;
  /** When the response was received (epoch ms). */
  createdAt: number;
};

/**
 * Where cached responses live. Keys come from `buildCacheKey`, so they are
 * already scoped to an identity.
 */
export type CacheStore = {
  /** The entry under `key`, or `undefined` if it is missing or expired. */
  get(key: string): Promise<CacheEntry | undefined>;
  /**
   * Store `entry` under `key` for `ttlMs`, replacing any entry already
   * there. `ttlMs` is how long the store keeps the entry, not how long it is
   * fresh: a stale entry with an `ETag` is kept so it can be revalidated. An
   * entry over the store's limits is not stored, and the one it would have
   * replaced is removed, so a later read cannot return the older response.
   */
  set(key: string, entry: CacheEntry, ttlMs: number): Promise<void>;
  /**
   * Remove `identity`'s entries whose URL starts with `urlPrefix`, as
   * returned by `computeInvalidationPrefixes`. Other identities' entries
   * are kept.
   */
  deleteMatching(identity: string, urlPrefix: string): Promise<void>;
};
