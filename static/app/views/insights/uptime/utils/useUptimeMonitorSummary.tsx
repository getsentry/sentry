import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
   * The window configuration object, if supplied the `start` and `end` will be
   * calculated using the timewindow start end time.
   */
  timeWindowConfig?: TimeWindowConfig;
}

/**
 * Fetches Uptime Monitor summaries
 */
export function useUptimeMonitorSummaries({detectorIds, timeWindowConfig}: Options) {
  const selectionQuery: Record<string, any> = {};

  if (timeWindowConfig) {
    selectionQuery.start = Math.floor(timeWindowConfig.start.getTime() / 1000);
    selectionQuery.end = Math.floor(timeWindowConfig.end.getTime() / 1000);
  }

  const organization = useOrganization();

  return useApiQuery<Record<string, UptimeSummary>>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/uptime-summary/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          uptimeDetectorId: detectorIds,
          ...selectionQuery,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !timeWindowConfig || timeWindowConfig.rollupConfig.totalBuckets > 0,
    }
  );
}
