import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {
  getTraceSamplesTableFields,
  TraceSamplesTableEmbeddedColumns,
} from 'sentry/views/explore/metrics/constants';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';

/** How many metrics the abbreviated section renders before offering "View more". */
export const NUMBER_ABBREVIATED_METRICS = 5;
/**
 * How many metrics to fetch. This is larger than what the abbreviated section shows
 * because the same query also feeds the event-context timeline, which renders many
 * more (clustering keeps them legible). The section still slices to
 * NUMBER_ABBREVIATED_METRICS, so raising this only widens the shared request — it
 * doesn't change what the section displays.
 */
export const TIMELINE_METRICS_LIMIT = 50;

export function useMetricsIssueSection({traceId}: {traceId: string}) {
  const fields = getTraceSamplesTableFields(TraceSamplesTableEmbeddedColumns);
  return useMetricSamplesTable({
    disabled: !traceId,
    limit: TIMELINE_METRICS_LIMIT,
    traceMetric: undefined,
    fields,
    staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
  });
}
