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
