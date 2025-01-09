import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';
import {SpanFunction, SpanIndexedField} from 'sentry/views/insights/types';

export const STARFISH_AGGREGATION_FIELDS: Record<
  SpanFunction,
  FieldDefinition & {defaultOutputType: AggregationOutputType}
> = {
  [SpanFunction.SPS]: {
    desc: t('Spans per second'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.SPM]: {
    desc: t('Spans per minute'),
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
  [SpanFunction.HTTP_ERROR_COUNT]: {
    desc: t('Count of 5XX http errors'),
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
};

const RELEASE_FILTERS: FilterKeySection = {
  value: 'release_filters',
  label: 'Release',
  children: [SpanIndexedField.RELEASE],
};

const TRANSACTION_FILTERS: FilterKeySection = {
  value: 'transaction_filters',
  label: 'Transaction',
  children: [
    SpanIndexedField.TRANSACTION_METHOD,
    SpanIndexedField.TRANSACTION_OP,
    SpanIndexedField.TRANSACTION,
    SpanIndexedField.TRANSACTION_ID,
  ],
};

const USER_CONTEXT_FILTERS: FilterKeySection = {
  value: 'user_context_filters',
  label: 'User',
  children: [
    SpanIndexedField.USER,
    SpanIndexedField.USER_ID,
    SpanIndexedField.USER_IP,
    SpanIndexedField.USER_EMAIL,
    SpanIndexedField.USER_USERNAME,
    SpanIndexedField.USER_GEO_SUBREGION,
  ],
};

const SPAN_FILTERS: FilterKeySection = {
  value: 'span_filters',
  label: 'Span',
  children: [
    SpanIndexedField.SPAN_OP,
    SpanIndexedField.SPAN_DURATION,
    SpanIndexedField.SPAN_SELF_TIME,
    SpanIndexedField.SPAN_DESCRIPTION,
    SpanIndexedField.SPAN_STATUS,
    SpanIndexedField.SPAN_ACTION,
    SpanIndexedField.SPAN_DOMAIN,
    SpanIndexedField.SPAN_MODULE,
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
