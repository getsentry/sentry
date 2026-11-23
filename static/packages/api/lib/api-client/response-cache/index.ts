/**
 * Response cache shared by the CLI and MCP: fallback TTL tiers,
 * identity-scoped keys, mutation invalidation prefixes, HTTP freshness and
 * revalidation, the `CacheStore` interface, and a byte-budgeted memory
 * store. No Node APIs or I/O; hosts with persistent storage implement
 * `CacheStore` themselves.
 */

export type { BodyCodec, BodyEncoding, EncodedBody } from "./body.js";
export { computeInvalidationPrefixes } from "./invalidation.js";
export { buildCacheKey, normalizeUrl } from "./keys.js";
export {
  createMemoryStore,
  type MemoryStore,
  type MemoryStoreOptions,
} from "./memory-store.js";
export {
  type CacheLookup,
  type LookupOptions,
  lookupResponse,
  REVALIDATION_WINDOW_MS,
  type StoreOptions,
  storeResponse,
} from "./policy.js";
export type { CacheEntry, CacheStore } from "./store.js";
export { classifyUrl, FALLBACK_TTL_MS, type TtlTier } from "./tiers.js";
