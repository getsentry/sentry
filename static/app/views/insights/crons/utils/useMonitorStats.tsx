import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {MonitorBucket} from 'sentry/views/insights/crons/types';

interface Options {
  /**
   * The list of monitor IDs to fetch stats for
   */
  monitors: string[];
  /**
   * The window configuration object
   */
  timeWindowConfig: TimeWindowConfig;
  /**
   * Do not query stats when set to false
   */
  enabled?: boolean;
}

type Result = Record<string, MonitorBucket[]>;

/**
 * Fetches Monitor stats
 */
export function useMonitorStats(
  {monitors, timeWindowConfig, enabled = true}: Options,
  options: Partial<UseApiQueryOptions<Result>> = {}
) {
  const {start, end, rollupConfig} = timeWindowConfig;

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until: Math.floor(end.getTime() / 1000),
    resolution: `${rollupConfig.interval}s`,
  };

  const organization = useOrganization();
  const location = useLocation();

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;

  return useApiQuery<Result>(
    [
      monitorStatsQueryKey,
      {
        query: {
          monitor: monitors,
          project: location.query.project,
          environment: location.query.environment,
          ...selectionQuery,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: enabled && rollupConfig.totalBuckets > 0,
      ...options,
    }
  );
}
