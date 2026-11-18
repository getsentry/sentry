import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

import {MetricsSamplesTable} from './metricsSamplesTable';

// Histograms are stored as buckets, so only their exemplars are individual samples
const HISTOGRAM_SAMPLES_QUERY = 'sentry._internal.row_kind:exemplar';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function SamplesTab({traceMetric, isMetricOptionsEmpty}: SamplesTabProps) {
  return (
    <MetricsSamplesTable
      traceMetric={traceMetric}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
      requiredQuery={
        traceMetric.type === 'histogram' ? HISTOGRAM_SAMPLES_QUERY : undefined
      }
    />
  );
}
