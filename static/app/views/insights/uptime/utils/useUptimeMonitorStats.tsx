import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import type {CheckStatusBucket} from '../types';

interface Options {
  /**
   * The list of uptime monitor IDs to fetch stats for. These are the numeric
   * IDs of the UptimeRukle id's
   */
  ruleIds: string[];
  /**
   * The window configuration object
   */
  timeWindowConfig: TimeWindowConfig;
}

/**
 * Fetches Uptime Monitor stats
 */
export function useUptimeMonitorStats({ruleIds, timeWindowConfig}: Options) {
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

  const monitorStatsQueryKey = `/organizations/${organization.slug}/uptime-stats/`;

  return useApiQuery<Record<string, CheckStatusBucket[]>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          projectUptimeSubscriptionId: ruleIds,
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
