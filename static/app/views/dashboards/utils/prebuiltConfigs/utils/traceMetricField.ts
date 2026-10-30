import type {DataUnit} from 'sentry/utils/discover/fields';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

type TraceMetricAggregation = 'avg' | 'sum' | 'max' | 'count' | 'p75';

// Metric units are free-form strings on the backend. `DataUnit` covers the
// duration and size units; `ratio` is how Relay labels 0-1 fractions.
type TraceMetricUnit = DataUnit | 'ratio';

// Trace metric field format: `aggregation(value,metric_name,metric_type,unit)`
export function traceMetricField(
  aggregation: TraceMetricAggregation,
  name: string,
  metricType: TraceMetricTypeValue,
  unit: TraceMetricUnit
) {
  return `${aggregation}(value,${name},${metricType},${unit ?? NONE_UNIT})`;
}
