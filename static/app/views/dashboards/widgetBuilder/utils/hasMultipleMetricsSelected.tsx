import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function hasMultipleMetricsSelected(traceMetrics: TraceMetric[]) {
  // Create a set of the trace metrics in a consistent string format to
  // check if there are multiple metrics
  const countUniqueMetrics = new Set(
    traceMetrics.map(({name, type, unit}) => `${name},${type},${unit}`)
  ).size;
  return countUniqueMetrics > 1;
}
