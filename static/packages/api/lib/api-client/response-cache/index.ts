/**
 * What a host's response cache needs to know about Sentry: fallback TTL
 * tiers for responses without freshness headers, and the prefixes a
 * mutation makes stale. The cache itself, storage, and body encoding are the
 * host's; plug one in through the transport's `cache`.
 */

export { computeInvalidationPrefixes } from "./invalidation.js";
export { classifyUrl, FALLBACK_TTL_MS, type TtlTier } from "./tiers.js";
