import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';
import {SpanFunction} from 'sentry/views/insights/types';

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
