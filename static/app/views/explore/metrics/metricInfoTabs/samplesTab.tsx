import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

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
