import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
  preservePreviousData?: boolean;
  queriesEnabled?: boolean;
  showEmptyResults?: boolean;
}

export function SamplesTab({
  traceMetric,
  isMetricOptionsEmpty,
  preservePreviousData,
  queriesEnabled,
  showEmptyResults,
}: SamplesTabProps) {
  return (
    <MetricsSamplesTable
      traceMetric={traceMetric}
      queriesEnabled={queriesEnabled}
      preservePreviousData={preservePreviousData}
      showEmptyResults={showEmptyResults}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
    />
  );
}
