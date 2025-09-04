import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

interface Options {
  /**
   * The list of uptime monitor IDs to fetch summaries for. These are the numeric
   * IDs of the UptimeRule id's
   */
  detectorIds: string[];
  /**
   * Optional end time for calculating the summary
   */
  end?: Date;
  /**
   * Optional start time for calculating the summary
   */
  start?: Date;
}

/**
 * Fetches Uptime Monitor summaries
 */
export function useUptimeMonitorSummaries({detectorIds, start, end}: Options) {
  const selectionQuery: Record<string, any> = {};

  if (start) {
    selectionQuery.start = Math.floor(start.getTime() / 1000);
  }
  if (end) {
    selectionQuery.end = Math.floor(end.getTime() / 1000);
  }

  const organization = useOrganization();
  const monitorStatsQueryKey = `/organizations/${organization.slug}/uptime-summary/`;

  return useApiQuery<Record<string, UptimeSummary>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          uptimeDetectorId: detectorIds,
          ...selectionQuery,
        },
      },
    ],
    {staleTime: 0}
  );
}
