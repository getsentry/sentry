import {t} from 'sentry/locale';
import type {EventOccurrence} from 'sentry/types/event';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {
  LlmCacheContrastAnchor,
  LlmCacheEvidenceData,
  LlmCacheOutcome,
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
const GEN_AI_CALL_OP = 'gen_ai.generate_content';

export const LLM_CACHE_REFERRER = 'llm-cache-usage-issue';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSampleCalls(value: unknown, traceIds: unknown): LlmCacheSampleCall[] {
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
          timestamp: getStringValue(sample.timestamp),
          inputTokens: getNumberValue(sample.inputTokens),
          cacheReadTokens: getNumberValue(sample.cacheReadTokens),
          cacheCreationTokens: getNumberValue(sample.cacheCreationTokens),
        },
      ];
    });
  }

  // Occurrences produced before the detector emitted the richer samples carry
  // bare trace ids; they still link somewhere useful.
  if (Array.isArray(traceIds)) {
    const ids: unknown[] = traceIds;
    return ids.flatMap(entry => {
      const traceId = getStringValue(entry);
      return traceId === null
        ? []
        : [
            {
              traceId,
              spanId: null,
              timestamp: null,
              inputTokens: null,
              cacheReadTokens: null,
              cacheCreationTokens: null,
            },
          ];
    });
  }

  return [];
}

function getAnchor(data: Record<string, unknown>): LlmCacheContrastAnchor | null {
  const model = getStringValue(data.contrastModel);
  const transaction = getStringValue(data.contrastTransaction);
  const spanDescription = getStringValue(data.contrastSpanDescription);
  const hitRate = getNumberValue(data.contrastHitRate);

  if (
    model === null ||
    transaction === null ||
    spanDescription === null ||
    hitRate === null
  ) {
    return null;
  }

  return {
    model,
    transaction,
    spanDescription,
    hitRate,
    callCount: getNumberValue(data.contrastCallCount),
    avgInputTokens: getNumberValue(data.contrastAvgInputTokens),
  };
}

export function getLlmCacheEvidenceData(
  evidenceData: EventOccurrence['evidenceData'] | null | undefined
): LlmCacheEvidenceData {
  const data = isRecord(evidenceData) ? evidenceData : {};

  return {
    outcome: getOutcome(data.outcome),
    transaction: getStringValue(data.transaction),
    spanDescription: getStringValue(data.spanDescription),
    model: getStringValue(data.model),
    callCount: getNumberValue(data.callCount),
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
    windowStart: getStringValue(data.windowStart),
    windowEnd: getStringValue(data.windowEnd),
    sampleCalls: getSampleCalls(data.sampleTraces, data.sampleTraceIds),
    anchor: getAnchor(data),
  };
}

/**
 * The exact filter for one call site. The detector groups by this triple, so it
 * is also what makes live queries line up with the finding.
 */
export function buildCallSiteQuery({
  transaction,
  spanDescription,
  model,
}: {
  model: string | null;
  spanDescription: string | null;
  transaction: string | null;
}): string | null {
  if (transaction === null || spanDescription === null || model === null) {
    return null;
  }

  return MutableSearch.fromQueryObject({
    'span.op': GEN_AI_CALL_OP,
    transaction,
    'span.description': spanDescription,
    'gen_ai.request.model': model,
  }).formatString();
}

export function formatTokens(tokens: number | null): string {
  if (tokens === null) {
    return t('Unknown');
  }
  if (tokens < 1000) {
    return tokens.toLocaleString(undefined, {maximumFractionDigits: 0});
  }
  if (tokens < 1_000_000) {
    return t('~%sK', (tokens / 1000).toFixed(1));
  }
  return t('~%sM', (tokens / 1_000_000).toFixed(1));
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
  return `${(rate * 100).toFixed(2)}%`;
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
