import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

export const STARFISH_AGGREGATION_FIELDS: Partial<
  Record<SpanFunction, FieldDefinition & {defaultOutputType: AggregationOutputType}>
> = {
  [SpanFunction.EPM]: {
    desc: t('Events per second'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TPM]: {
    desc: t('Transactions per minute'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TIME_SPENT_PERCENTAGE]: {
    desc: t('Span time spent percentage'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_RESPONSE_COUNT]: {
    desc: t('Count of HTTP responses by code'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_RESPONSE_RATE]: {
    desc: t('Percentage of HTTP responses by code'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_HIT_RATE]: {
    desc: t('Percentage of cache hits'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_MISS_RATE]: {
    desc: t('Percentage of cache misses'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.COUNT_OP]: {
    desc: t('Count of spans with matching operation'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TRACE_STATUS_RATE]: {
    desc: t('Percentage of spans with matching trace status'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.FAILURE_RATE_IF]: {
    desc: t('Failed event percentage based on span.status'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.COUNT]: {
    desc: t('Count of spans'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
};

const RELEASE_FILTERS: FilterKeySection = {
  value: 'release_filters',
  label: 'Release',
  children: [SpanFields.RELEASE],
};

const TRANSACTION_FILTERS: FilterKeySection = {
  value: 'transaction_filters',
  label: 'Transaction',
  children: [
    SpanFields.TRANSACTION_METHOD,
    SpanFields.TRANSACTION_OP,
    SpanFields.TRANSACTION,
    SpanFields.TRANSACTION_SPAN_ID,
  ],
};

const USER_CONTEXT_FILTERS: FilterKeySection = {
  value: 'user_context_filters',
  label: 'User',
  children: [
    SpanFields.USER,
    SpanFields.USER_ID,
    SpanFields.USER_IP,
    SpanFields.USER_EMAIL,
    SpanFields.USER_USERNAME,
    SpanFields.USER_GEO_SUBREGION,
  ],
};

const SPAN_FILTERS: FilterKeySection = {
  value: 'span_filters',
  label: 'Span',
  children: [
    SpanFields.SPAN_OP,
    SpanFields.SPAN_DURATION,
    SpanFields.SPAN_SELF_TIME,
    SpanFields.SPAN_DESCRIPTION,
    SpanFields.SPAN_STATUS,
    SpanFields.SPAN_ACTION,
    SpanFields.SPAN_DOMAIN,
    SpanFields.SPAN_CATEGORY,
  ],
};

const EVENT_FILTERS: FilterKeySection = {
  value: 'event_filters',
  label: 'Event',
  children: [
    ...SPAN_FILTERS.children,
    ...TRANSACTION_FILTERS.children,
    ...RELEASE_FILTERS.children,
  ],
};

export const SPANS_FILTER_KEY_SECTIONS: FilterKeySection[] = [
  EVENT_FILTERS,
  USER_CONTEXT_FILTERS,
];

export const COUNTER_AGGREGATES = [
  SpanFunction.SUM,
  SpanFunction.AVG,
  SpanFunction.MIN,
  SpanFunction.MAX,
  SpanFunction.P100,
  SpanFunction.COUNT,
] as const;

export const DISTRIBUTION_AGGREGATES = [
  SpanFunction.P50,
  SpanFunction.P75,
  SpanFunction.P90,
  SpanFunction.P95,
  SpanFunction.P99,
] as const;

export const SPAN_FUNCTIONS = [
  SpanFunction.EPM,
  SpanFunction.TPM,
  SpanFunction.COUNT,
  SpanFunction.TIME_SPENT_PERCENTAGE,
  SpanFunction.HTTP_RESPONSE_RATE,
  SpanFunction.HTTP_RESPONSE_COUNT,
  SpanFunction.CACHE_HIT_RATE,
  SpanFunction.CACHE_MISS_RATE,
  SpanFunction.SUM,
  SpanFunction.FAILURE_RATE,
] as const;

// Maps the subregion code to the subregion name according to UN m49 standard
// We also define this in relay in `country_subregion.rs`
export const subregionCodeToName = {
  '21': 'North America',
  '13': 'Central America',
  '29': 'Caribbean',
  '5': 'South America',
  '154': 'Northern Europe',
  '155': 'Western Europe',
  '39': 'Southern Europe',
  '151': 'Eastern Europe',
  '30': 'Eastern Asia',
  '34': 'Southern Asia',
  '35': 'South Eastern Asia',
  '145': 'Western Asia',
  '143': 'Central Asia',
  '15': 'Northern Africa',
  '11': 'Western Africa',
  '17': 'Middle Africa',
  '14': 'Eastern Africa',
  '18': 'Southern Africa',
  '54': 'Melanesia',
  '57': 'Micronesia',
  '61': 'Polynesia',
  '53': 'Australia and New Zealand',
};
