import type {PageFilters} from 'sentry/types/core';

export const ALL_RESULTS = 'all';

export const CLASSIFIER_DATASETS = ['conversation', 'trace_spans'] as const;

export const CLASSIFIER_DETAIL_DEFAULT_SELECTION = {
  datetime: {period: '24h', start: null, end: null, utc: null},
} satisfies Partial<PageFilters>;

export const CLASSIFIER_PREVIEW_PER_PAGE = 10;

export const ENRICHMENT_ATTRIBUTE_PREFIX = 'sentry.enrichment.';
