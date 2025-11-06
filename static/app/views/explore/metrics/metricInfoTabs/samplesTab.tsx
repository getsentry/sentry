import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface SamplesTabProps {
  traceMetric: TraceMetric;
}

export function SamplesTab({traceMetric}: SamplesTabProps) {
  return <MetricsSamplesTable traceMetric={traceMetric} />;
}
