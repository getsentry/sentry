import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {EventOccurrence} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import type {
  LlmCacheAgentLabelSource,
  LlmCacheContrastAnchor,
  LlmCacheEvidenceData,
  LlmCacheOutcome,
  LlmCachePromptDivergence,
  LlmCachePromptDivergenceKind,
  LlmCacheSampleCall,
} from './types';

/**
 * Span attributes the detector aggregates. The resolver back-fills the
 * deprecated aliases onto these names, so querying them here reads the same
 * data the finding was derived from.
 */
export const INPUT_TOKENS_ATTRIBUTE = 'gen_ai.usage.input_tokens';
export const CACHE_READ_TOKENS_ATTRIBUTE = 'gen_ai.usage.cache_read.input_tokens';
export const CACHE_CREATION_TOKENS_ATTRIBUTE = 'gen_ai.usage.cache_creation.input_tokens';
const MODEL_ATTRIBUTE = 'gen_ai.request.model';
const SPAN_NAME_ATTRIBUTE = 'span.name';
const AGENT_NAME_ATTRIBUTE = 'gen_ai.agent.name';
const OPERATION_NAME_ATTRIBUTE = 'gen_ai.operation.name';
/**
 * The detector's own span filter, verbatim -- any divergence means the page's
 * live queries answer a different question than the finding.
 *
 * `gen_ai.operation.type` is added during ingestion from the op, so it matches
 * an LLM call whichever op the SDK chose.
 */
const GEN_AI_CALL_FILTER =
  'gen_ai.operation.type:ai_client !gen_ai.operation.name:embeddings has:gen_ai.usage.input_tokens';

export const LLM_CACHE_REFERRER = 'llm-cache-usage-issue';

/**
 * Whether the call site is named after its operation because its spans carry no
 * agent name. Worth surfacing: the label reads like an agent but names none, and
 * the group can hold calls from several.
 */
export function usesOperationNameFallback(
  source: LlmCacheAgentLabelSource | null
): boolean {
  return source === OPERATION_NAME_ATTRIBUTE;
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}

function getNumberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function getOutcome(value: unknown): LlmCacheOutcome | null {
  return value === 'not_caching' || value === 'thrash' ? value : null;
}

function getAgentLabelSource(value: unknown): LlmCacheAgentLabelSource | null {
  return value === AGENT_NAME_ATTRIBUTE || value === OPERATION_NAME_ATTRIBUTE
    ? value
    : null;
}

/**
 * A timestamp only counts if it can be parsed: consumers hand these to date
 * helpers that throw, and a throw here blanks the whole issue body.
 */
function getTimestampValue(value: unknown): string | null {
  const timestamp = getStringValue(value);
  if (timestamp === null || Number.isNaN(new Date(timestamp).valueOf())) {
    return null;
  }
  return timestamp;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSampleCalls(value: unknown): LlmCacheSampleCall[] {
  if (Array.isArray(value)) {
    const samples: unknown[] = value;
    return samples.flatMap(entry => {
      const sample = isRecord(entry) ? entry : null;
      const traceId = getStringValue(sample?.traceId);
      if (sample === null || traceId === null) {
        return [];
      }
      return [
        {
          traceId,
          spanId: getStringValue(sample.spanId),
          timestamp: getTimestampValue(sample.timestamp),
          inputTokens: getNumberValue(sample.inputTokens),
          cacheReadTokens: getNumberValue(sample.cacheReadTokens),
          cacheCreationTokens: getNumberValue(sample.cacheCreationTokens),
        },
      ];
    });
  }

  return [];
}

function getAnchor(data: Record<string, unknown>): LlmCacheContrastAnchor | null {
  const model = getStringValue(data.contrastModel);
  const agentLabel = getStringValue(data.contrastAgentLabel);
  const spanName = getStringValue(data.contrastSpanName);
  const hitRate = getNumberValue(data.contrastHitRate);

  if (model === null || agentLabel === null || spanName === null || hitRate === null) {
    return null;
  }

  return {
    model,
    agentLabel,
    agentLabelSource: getAgentLabelSource(data.contrastAgentLabelSource),
    spanName,
    hitRate,
    callCount: getNumberValue(data.contrastCallCount),
    avgInputTokens: getNumberValue(data.contrastAvgInputTokens),
  };
}

const PROMPT_DIVERGENCE_KINDS: readonly LlmCachePromptDivergenceKind[] = [
  'none',
  'iso_timestamp',
  'epoch_timestamp',
  'uuid',
  'identifier',
  'counter',
  'other',
];

function getPromptDivergenceKind(value: unknown): LlmCachePromptDivergenceKind | null {
  return PROMPT_DIVERGENCE_KINDS.find(kind => kind === value) ?? null;
}

/**
 * The prompt diagnosis, or null when the occurrence carries none.
 *
 * The kind and the shared prefix are what every sentence on the page is built
 * from, so an occurrence missing either has nothing to say and is dropped whole
 * rather than rendered half-empty.
 */
function getPromptDivergence(
  data: Record<string, unknown>
): LlmCachePromptDivergence | null {
  const kind = getPromptDivergenceKind(data.promptDivergenceKind);
  const commonPrefixChars = getNumberValue(data.promptCommonPrefixChars);

  if (kind === null || commonPrefixChars === null) {
    return null;
  }

  return {
    kind,
    commonPrefixChars,
    sampleCount: getNumberValue(data.promptSampleCount),
    shortestChars: getNumberValue(data.promptShortestChars),
    prefixShare: getNumberValue(data.promptPrefixShare),
    stableBlockChars: getNumberValue(data.promptStableBlockChars),
    templateMisordered: data.promptTemplateMisordered === true,
  };
}

export function getLlmCacheEvidenceData(
  evidenceData: EventOccurrence['evidenceData'] | null | undefined
): LlmCacheEvidenceData {
  const data = isRecord(evidenceData) ? evidenceData : {};

  return {
    outcome: getOutcome(data.outcome),
    agentLabel: getStringValue(data.agentLabel),
    agentLabelSource: getAgentLabelSource(data.agentLabelSource),
    spanName: getStringValue(data.spanName),
    model: getStringValue(data.model),
    callCount: getNumberValue(data.callCount),
    warmCallCount: getNumberValue(data.warmCallCount),
    cacheableShare: getNumberValue(data.cacheableShare),
    hitRate: getNumberValue(data.hitRate),
    writeReadRatio: getNumberValue(data.writeReadRatio),
    avgInputTokens: getNumberValue(data.avgInputTokens),
    uncachedTokens: getNumberValue(data.uncachedTokens),
    sumInputTokens: getNumberValue(data.sumInputTokens),
    sumCacheReadTokens: getNumberValue(data.sumCacheReadTokens),
    sumCacheCreationTokens: getNumberValue(data.sumCacheCreationTokens),
    estimatedSavingsUsd: getNumberValue(data.estimatedSavingsUsd),
    overpayVsNoCacheUsd: getNumberValue(data.overpayVsNoCacheUsd),
    windowDays: getNumberValue(data.windowDays),
    windowStart: getTimestampValue(data.windowStart),
    windowEnd: getTimestampValue(data.windowEnd),
    sampleCalls: getSampleCalls(data.sampleTraces),
    anchor: getAnchor(data),
    promptDivergence: getPromptDivergence(data),
  };
}

/**
 * Whether the search grammar can match this value exactly.
 *
 * Mirrors the detector's own rule: a trailing backslash escapes the term's
 * closing quote, and a backslash before a `*` reads as an escaped wildcard
 * however the star is written, so the literal cannot be expressed at all.
 */
function isExpressible(value: string): boolean {
  return !value.endsWith('\\') && !value.includes('\\*');
}

/**
 * The exact filter for one call site. The detector groups by this triple, so it
 * is also what makes live queries line up with the finding.
 *
 * Returns null when a value cannot be matched exactly, because a query that
 * quietly matches the wrong spans is worse than no link at all.
 */
export function buildCallSiteQuery({
  agentLabel,
  agentLabelSource,
  spanName,
  model,
}: {
  agentLabel: string | null;
  agentLabelSource: LlmCacheAgentLabelSource | null;
  model: string | null;
  spanName: string | null;
}): string | null {
  if (agentLabel === null || agentLabelSource === null || spanName === null) {
    return null;
  }
  if (model === null || ![agentLabel, spanName, model].every(isExpressible)) {
    return null;
  }

  const search = new MutableSearch(GEN_AI_CALL_FILTER);
  if (agentLabelSource === OPERATION_NAME_ATTRIBUTE) {
    // The operation name only stands in for an agent on spans that carry no
    // agent name, so the absence is part of the group: without it the query
    // also returns the named spans sharing the operation.
    search.addFilterValue('!has', AGENT_NAME_ATTRIBUTE);
  }
  // Escaped rather than passed through: these are literals off a span, and an
  // unescaped `*` in one would silently widen the match to its siblings.
  search.addFilterValue(agentLabelSource, agentLabel, true);
  search.addFilterValue(SPAN_NAME_ATTRIBUTE, spanName, true);
  search.addFilterValue(MODEL_ATTRIBUTE, model, true);
  return search.formatString();
}

/**
 * How a call site is written on the page, mirroring the issue's own subtitle.
 *
 * Gen-AI span names conventionally embed the agent (`invoke_agent Planner`), so
 * naming it again just spends width on a duplicate. Either half can be missing
 * on an older occurrence, so the label falls back to whichever one there is.
 */
export function formatCallSiteLabel({
  agentLabel,
  spanName,
}: {
  agentLabel: string | null;
  spanName: string | null;
}): string {
  if (spanName === null) {
    return agentLabel ?? t('Unknown');
  }
  if (agentLabel === null || spanName.toLowerCase().includes(agentLabel.toLowerCase())) {
    return spanName;
  }
  return `${agentLabel} | ${spanName}`;
}

/**
 * A link to the spans a query matches, over the window the finding covers.
 * Undefined without both: a link to the wrong spans is worse than no link.
 */
export function getCallSiteExploreUrl({
  organization,
  selection,
  query,
}: {
  organization: Organization;
  query: string | null;
  selection: PageFilters | undefined;
}): string | undefined {
  if (query === null || selection === undefined) {
    return undefined;
  }
  return getExploreUrl({
    organization,
    selection,
    mode: Mode.SAMPLES,
    query,
    referrer: LLM_CACHE_REFERRER,
  });
}

function formatApproximateCount(value: number): string {
  if (value < 1000) {
    return value.toLocaleString(undefined, {maximumFractionDigits: 0});
  }
  // Guard on the rounded figure, not the raw one: 999,999 round to 1000.0K,
  // which should read as 1.0M.
  const thousands = (value / 1_000).toFixed(1);
  if (Number(thousands) < 1_000) {
    return t('~%sK', thousands);
  }
  return t('~%sM', (value / 1_000_000).toFixed(1));
}

export function formatTokens(tokens: number | null): string {
  if (tokens === null) {
    return t('Unknown');
  }
  return formatApproximateCount(tokens);
}

/**
 * A prompt length, on the same approximate scale as token counts: it is read
 * off a few sampled prompts the span store may have truncated, so exact digits
 * would claim more than the measurement supports.
 */
export function formatCharacters(characters: number | null): string {
  if (characters === null) {
    return t('Unknown');
  }
  return t('%s chars', formatApproximateCount(characters));
}

export function formatRate(rate: number | null): string {
  if (rate === null) {
    return t('Unknown');
  }
  if (rate === 0) {
    return '0%';
  }
  if (rate < 0.0001) {
    return t('<0.01%');
  }
  // Providers that report input exclusive of cached tokens can drive reads past
  // input; the detector clamps the token split the same way.
  return `${(Math.min(rate, 1) * 100).toFixed(2)}%`;
}

/**
 * The calls a warm cache was available to, as a count and a share of all calls.
 * The share carries the meaning -- a bare count says nothing about whether the
 * rest of the traffic ever had a cache to hit -- so it is left out only when an
 * occurrence does not carry one.
 */
export function formatCacheEligibleCalls(
  warmCallCount: number | null,
  cacheableShare: number | null
): string {
  if (warmCallCount === null) {
    return t('Unknown');
  }
  const calls = Math.round(warmCallCount).toLocaleString();
  if (cacheableShare === null) {
    return calls;
  }
  return t('%s (%s of calls)', calls, formatRate(cacheableShare));
}

export function formatWriteReadRatio(ratio: number | null): string {
  if (ratio === null) {
    return t('no cache reads');
  }
  return t('%s:1', ratio.toFixed(1));
}

export function formatUsd(amount: number | null): string {
  if (amount === null) {
    return t('Unknown');
  }
  if (amount > 0 && amount < 0.01) {
    return t('<$0.01');
  }
  return amount.toLocaleString(undefined, {
    currency: 'USD',
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
    minimumFractionDigits: amount >= 1000 ? 0 : 2,
    style: 'currency',
  });
}

type CacheProvider = 'anthropic' | 'openai' | 'google' | 'unknown';

/**
 * Which provider's caching rules apply, inferred from the model name.
 *
 * Crude on purpose, and mirrors the marker matching the detector already does:
 * nothing on the span states the provider.
 */
export function getCacheProvider(model: string | null): CacheProvider {
  const normalized = model?.toLowerCase() ?? '';
  if (normalized.includes('claude') || normalized.includes('anthropic')) {
    return 'anthropic';
  }
  if (normalized.includes('gemini') || normalized.includes('google')) {
    return 'google';
  }
  if (/gpt|^o\d|[^a-z]o\d/.test(normalized) || normalized.includes('openai')) {
    return 'openai';
  }
  return 'unknown';
}

const PROMPT_CACHING_DOCS: Record<CacheProvider, string> = {
  anthropic: 'https://docs.claude.com/en/docs/build-with-claude/prompt-caching',
  openai: 'https://platform.openai.com/docs/guides/prompt-caching',
  google: 'https://ai.google.dev/gemini-api/docs/caching',
  unknown: 'https://docs.sentry.io/product/insights/agents/',
};

export function getPromptCachingDocsUrl(model: string | null): string {
  return PROMPT_CACHING_DOCS[getCacheProvider(model)];
}

/**
 * Reads as the tail of "the prompts first differ at ...".
 *
 * `none` is deliberately unhandled: there is nothing to name, and the callers
 * that would use this say something else entirely in that case.
 */
export function getPromptDivergenceDescription(
  kind: LlmCachePromptDivergenceKind
): string {
  switch (kind) {
    case 'iso_timestamp':
      return t('an ISO-8601 timestamp');
    case 'epoch_timestamp':
      return t('a Unix timestamp');
    case 'uuid':
      return t('a UUID');
    case 'identifier':
      return t('a request or trace id');
    case 'counter':
      return t('a changing number');
    default:
      return t('changing text');
  }
}

export function getPromptCachingDocsLabel(model: string | null): string {
  switch (getCacheProvider(model)) {
    case 'anthropic':
      return t('Read the Anthropic prompt caching docs');
    case 'openai':
      return t('Read the OpenAI prompt caching docs');
    case 'google':
      return t('Read the Gemini context caching docs');
    default:
      return t('Read the AI Agents docs');
  }
}
