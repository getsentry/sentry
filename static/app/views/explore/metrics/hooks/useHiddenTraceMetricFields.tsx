import {useMemo} from 'react';

import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricFieldKey,
} from 'sentry/views/explore/metrics/types';

/**
 * A histogram's value is only the mean of each of its data points, so it can't be filtered
 * or grouped by.
 */
export function useHiddenTraceMetricFields(
  traceMetrics: TraceMetric[],
  hiddenFields: TraceMetricFieldKey[]
): TraceMetricFieldKey[] {
  const hasHistogram = traceMetrics.some(metric => metric.type === 'histogram');
  return useMemo(
    () =>
      hasHistogram
        ? [...hiddenFields, TraceMetricKnownFieldKey.METRIC_VALUE]
        : hiddenFields,
    [hasHistogram, hiddenFields]
  );
}
