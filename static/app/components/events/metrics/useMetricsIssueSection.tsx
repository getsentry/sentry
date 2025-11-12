import {TraceSamplesTableEmbeddedColumns} from 'sentry/views/explore/metrics/constants';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';

export const NUMBER_ABBREVIATED_METRICS = 5;

export function useMetricsIssueSection({traceId}: {traceId: string}) {
  const fields = TraceSamplesTableEmbeddedColumns.filter(
    c => getMetricTableColumnType(c) !== 'stat'
  );
  return useMetricSamplesTable({
    disabled: !traceId,
    limit: NUMBER_ABBREVIATED_METRICS + 1, // Just needs to be >5 to show the view more button
    traceMetric: undefined,
    fields,
  });
}
