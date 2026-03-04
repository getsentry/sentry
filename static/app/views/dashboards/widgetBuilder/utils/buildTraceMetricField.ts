import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function buildTraceMetricField(
  aggregation: AggregationKeyWithAlias,
  traceMetric: TraceMetric
): QueryFieldValue {
  return {
    kind: 'function',
    function: [aggregation, 'value', undefined, undefined],
    args: ['value', traceMetric.name, traceMetric.type, traceMetric.unit ?? '-'],
  };
}
