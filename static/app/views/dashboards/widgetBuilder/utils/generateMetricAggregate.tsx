import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function generateMetricAggregate(
  traceMetric: TraceMetric,
  queryFieldValue: QueryFieldValue
) {
  if (queryFieldValue.kind !== 'function') {
    return queryFieldValue.field;
  }

  return `${queryFieldValue.function[0]}(value,${traceMetric.name},${traceMetric.type},-)`;
}
