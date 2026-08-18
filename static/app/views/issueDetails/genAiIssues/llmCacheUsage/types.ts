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
 * How a call site got the name it is grouped and displayed under: an agent
 * somebody named, or the operation name standing in where there is none.
 */
export type LlmCacheAgentLabelSource = 'gen_ai.agent.name' | 'gen_ai.operation.name';

/**
 * A healthy call site on the same model in the same project. Its whole job is
 * to answer "maybe this model just doesn't cache well here".
 */
export interface LlmCacheContrastAnchor {
  agentLabel: string;
  agentLabelSource: LlmCacheAgentLabelSource | null;
  avgInputTokens: number | null;
  callCount: number | null;
  hitRate: number;
  model: string;
  spanName: string;
}

/**
 * What the detector knows about a call site, as carried on the occurrence.
 *
 * Every field is nullable: occurrences produced before a field existed keep
 * rendering, they just render less.
 */
export interface LlmCacheEvidenceData {
  agentLabel: string | null;
  agentLabelSource: LlmCacheAgentLabelSource | null;
  anchor: LlmCacheContrastAnchor | null;
  avgInputTokens: number | null;
  /** Share of all calls that had a warm cache to hit. */
  cacheableShare: number | null;
  callCount: number | null;
  estimatedSavingsUsd: number | null;
  hitRate: number | null;
  model: string | null;
  outcome: LlmCacheOutcome | null;
  overpayVsNoCacheUsd: number | null;
  sampleCalls: LlmCacheSampleCall[];
  spanName: string | null;
  sumCacheCreationTokens: number | null;
  sumCacheReadTokens: number | null;
  sumInputTokens: number | null;
  uncachedTokens: number | null;
  /**
   * Calls that arrived within the cache TTL of an earlier one at the same call
   * site, so a warm cache was there to hit. The hit rate is read against every
   * call, which makes this the figure that separates a broken cache from
   * traffic too sparse to have one.
   */
  warmCallCount: number | null;
  windowDays: number | null;
  windowEnd: string | null;
  windowStart: string | null;
  writeReadRatio: number | null;
}
