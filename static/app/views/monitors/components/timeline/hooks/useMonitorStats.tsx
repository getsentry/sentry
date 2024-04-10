import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import type {MonitorBucketData, TimeWindowConfig} from '../types';

interface Options {
  /**
   * The list of monitor IDs to fetch stats for
   */
  monitors: string[];
  /**
   * The window configuration object
   */
  timeWindowConfig: TimeWindowConfig;
}

/**
 * Fetches Monitor stats
 */
export function useMonitorStats({monitors, timeWindowConfig}: Options) {
  const {start, end, elapsedMinutes, timelineWidth} = timeWindowConfig;

  const rollup = Math.floor((elapsedMinutes * 60) / timelineWidth);

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until: Math.floor(end.getTime() / 1000),
    resolution: `${rollup}s`,
  };

  const organization = useOrganization();
  const router = useRouter();
  const location = router.location;

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;

  return useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          monitor: monitors,
          ...selectionQuery,
          ...location.query,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: timelineWidth > 0,
    }
  );
}
