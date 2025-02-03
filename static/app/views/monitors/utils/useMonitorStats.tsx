import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import type {MonitorBucket} from '../types';

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
  const {start, end, timelineWidth, rollupConfig} = timeWindowConfig;

  // Add the underscan to our selection time
  const additionalInterval =
    (rollupConfig.timelineUnderscanWidth / rollupConfig.bucketPixels) *
    rollupConfig.interval;

  // XXX(epurkhiser): We are dropping 1 bucket worth of data on the right side
  // to account for the fact that this bucket is actually over-scan becauase
  // the query on the backend is inclusive.
  const until =
    Math.floor(end.getTime() / 1000) + additionalInterval - rollupConfig.interval;

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until,
    resolution: `${rollupConfig.interval}s`,
  };

  const organization = useOrganization();
  const location = useLocation();

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;

  return useApiQuery<Record<string, MonitorBucket[]>>(
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
      enabled: timelineWidth > 0,
    }
  );
}
