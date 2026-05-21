import type {DataUnit} from 'sentry/utils/discover/fields';
import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

type TraceMetricAggregation = 'avg' | 'sum' | 'max';

// Trace metric field format: `aggregation(value,metric_name,metric_type,unit)`
export function traceMetricField(
  aggregation: TraceMetricAggregation,
  name: string,
  metricType: TraceMetricTypeValue,
  unit: DataUnit
) {
  return `${aggregation}(value,${name},${metricType},${unit ?? '-'})`;
}
