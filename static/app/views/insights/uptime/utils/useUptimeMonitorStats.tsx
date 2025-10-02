import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {CheckStatusBucket} from 'sentry/views/alerts/rules/uptime/types';

interface Options {
  /**
   * The list of uptime monitor IDs to fetch stats for. These are the numeric
   * IDs of the UptimeRukle id's
   */
  detectorIds: string[];
  /**
   * The window configuration object
   */
  timeWindowConfig: TimeWindowConfig;
}

type Result = Record<string, CheckStatusBucket[]>;

/**
 * Fetches Uptime Monitor stats
 */
export function useUptimeMonitorStats(
  {detectorIds, timeWindowConfig}: Options,
  options: Partial<UseApiQueryOptions<Result>> = {}
) {
  const {start, end, rollupConfig} = timeWindowConfig;

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until: Math.floor(end.getTime() / 1000),
    resolution: `${rollupConfig.interval}s`,
  };

  const organization = useOrganization();
  const monitorStatsQueryKey = `/organizations/${organization.slug}/uptime-stats/`;

  return useApiQuery<Result>(
    [
      monitorStatsQueryKey,
      {
        query: {
          uptimeDetectorId: detectorIds,
          ...selectionQuery,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: rollupConfig.totalBuckets > 0,
      ...options,
    }
  );
}
