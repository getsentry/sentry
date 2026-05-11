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

  // Format is: aggregate(value,metric_name,metric_type,unit) or aggregate_if(`query`,value,metric_name,metric_type,unit)
  const args = parsed.arguments ?? [];
  const offset = parsed.name.endsWith('_if') ? 1 : 0;
  const metricName = args[1 + offset] ?? '';
  const metricType = args[2 + offset] ?? '';
  const metricUnit = args[3 + offset] === '-' ? undefined : args[3 + offset];

  return {
    aggregation: parsed.name,
    traceMetric: {name: metricName, type: metricType, unit: metricUnit},
  };
}
