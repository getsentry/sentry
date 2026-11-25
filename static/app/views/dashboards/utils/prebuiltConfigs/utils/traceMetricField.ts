import type {DataUnit} from 'sentry/utils/discover/fields';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

type TraceMetricAggregation = 'avg' | 'sum' | 'max' | 'count' | 'p75';

// Trace metric field format: `aggregation(value,metric_name,metric_type,unit)`.
// `attribute` aggregates a numeric attribute on the metric instead of its value.
export function traceMetricField(
  aggregation: TraceMetricAggregation,
  name: string,
  metricType: TraceMetricTypeValue,
  unit: DataUnit,
  attribute = 'value'
) {
  return `${aggregation}(${attribute},${name},${metricType},${unit ?? NONE_UNIT})`;
}
