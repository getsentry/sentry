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
 * What sits at the point where a call site's sampled prompts stop agreeing.
 * `none` means they never did, as far as the sampled text went.
 */
export type LlmCachePromptDivergenceKind =
  | 'none'
  | 'iso_timestamp'
  | 'epoch_timestamp'
  | 'uuid'
  | 'identifier'
  | 'counter'
  | 'other';

/**
 * Where a handful of the call site's prompts stop agreeing, and what sits there.
 *
 * A provider caches a prefix, so this is the deterministic half of "why": the
 * shared prefix is all a cache could ever hold, and identical content trailing
 * the divergence is content the template put in the wrong order.
 *
 * Character lengths, not tokens — the detector measures the serialized message
 * list, and converting would dress a tokenizer-dependent guess up as a count.
 */
export interface LlmCachePromptDivergence {
  commonPrefixChars: number;
  kind: LlmCachePromptDivergenceKind;
  /** How much of the shortest sampled prompt the shared prefix covers. */
  prefixShare: number | null;
  sampleCount: number | null;
  shortestChars: number | null;
  /**
   * The largest identical block sitting anywhere after the divergence -- which
   * is where stranded content usually is, since a prompt ends with the caller's
   * own text. A lower bound: prompts are aligned in whole pieces, and the span
   * store truncates long attribute values.
   */
  stableBlockChars: number | null;
  /** Stable content sitting behind the variable part rather than in front. */
  templateMisordered: boolean;
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
  /** Absent whenever the spans carry no prompt text, which is the common case. */
  promptDivergence: LlmCachePromptDivergence | null;
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
