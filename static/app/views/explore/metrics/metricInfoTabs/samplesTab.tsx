import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
  queriesEnabled?: boolean;
  showEmptyResults?: boolean;
}

export function SamplesTab({
  traceMetric,
  isMetricOptionsEmpty,
  queriesEnabled,
  showEmptyResults,
}: SamplesTabProps) {
  return (
    <MetricsSamplesTable
      traceMetric={traceMetric}
      queriesEnabled={queriesEnabled}
      showEmptyResults={showEmptyResults}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
    />
  );
}
