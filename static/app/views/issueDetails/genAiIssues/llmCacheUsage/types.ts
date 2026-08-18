export type LlmCacheOutcome = 'not_caching' | 'thrash';

/**
 * One example call from the flagged call site, enough to deep-link into the
 * span that made it.
 */
export interface LlmCacheSampleCall {
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  inputTokens: number | null;
  spanId: string | null;
  timestamp: string | null;
  traceId: string;
}

/**
 * A healthy call site on the same model in the same project. Its whole job is
 * to answer "maybe this model just doesn't cache well here".
 */
export interface LlmCacheContrastAnchor {
  avgInputTokens: number | null;
  callCount: number | null;
  hitRate: number;
  model: string;
  spanDescription: string;
  transaction: string;
}

/**
 * What the detector knows about a call site, as carried on the occurrence.
 *
 * Every field is nullable: occurrences produced before a field existed keep
 * rendering, they just render less.
 */
export interface LlmCacheEvidenceData {
  anchor: LlmCacheContrastAnchor | null;
  avgInputTokens: number | null;
  callCount: number | null;
  estimatedSavingsUsd: number | null;
  hitRate: number | null;
  model: string | null;
  outcome: LlmCacheOutcome | null;
  overpayVsNoCacheUsd: number | null;
  sampleCalls: LlmCacheSampleCall[];
  spanDescription: string | null;
  sumCacheCreationTokens: number | null;
  sumCacheReadTokens: number | null;
  sumInputTokens: number | null;
  transaction: string | null;
  uncachedTokens: number | null;
  windowDays: number | null;
  windowEnd: string | null;
  windowStart: string | null;
  writeReadRatio: number | null;
}
