type TraceMetricAggregation = 'avg' | 'sum' | 'max';
type TraceMetricType = 'gauge' | 'counter';
type TraceMetricUnit = 'none' | 'byte' | 'second';

// Trace metric field format: `aggregation(value,metric_name,metric_type,unit)`
export function traceMetricField(
  aggregation: TraceMetricAggregation,
  name: string,
  metricType: TraceMetricType,
  unit: TraceMetricUnit
) {
  return `${aggregation}(value,${name},${metricType},${unit})`;
}
