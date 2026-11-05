import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

import {MetricsSamplesTable} from './metricsSamplesTable';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function SamplesTab({traceMetric, isMetricOptionsEmpty}: SamplesTabProps) {
  return (
    <MetricsSamplesTable
      traceMetric={traceMetric}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
    />
  );
}
