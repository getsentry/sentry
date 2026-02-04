import {parseFunction} from 'sentry/utils/discover/fields';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function parseMetricAggregate(aggregate: string): {
  aggregation: string;
  traceMetric: TraceMetric;
} {
  const parsed = parseFunction(aggregate);
  if (!parsed) {
    return {
      aggregation: 'count',
      traceMetric: {name: '', type: ''},
    };
  }

  // Format is: aggregate(value,metric_name,metric_type,unit)
  const args = parsed.arguments ?? [];
  const metricName = args[1] ?? '';
  const metricType = args[2] ?? '';

  return {
    aggregation: parsed.name,
    traceMetric: {name: metricName, type: metricType},
  };
}
