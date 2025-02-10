import {useState} from 'react';

import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {CheckStatusBucket} from 'sentry/views/alerts/rules/uptime/types';

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
  const {start, end, rollupConfig} = timeWindowConfig;
  const [now] = useState(() => new Date().getTime() / 1000);

  const until =
    Math.floor(end.getTime() / 1000) +
    rollupConfig.underscanPeriod -
    // XXX(epurkhiser): We are dropping 1 bucket worth of data on the right
    // side to account for the fact that this bucket is actually over-scan
    // becauase the query on the backend is inclusive.
    rollupConfig.interval;

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until: Math.min(until, now),
    resolution: `${rollupConfig.interval}s`,
  };

  const organization = useOrganization();
  const monitorStatsQueryKey = `/organizations/${organization.slug}/uptime-stats/`;

  return useApiQuery<Record<string, CheckStatusBucket[]>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          projectUptimeSubscriptionId: ruleIds,
          ...selectionQuery,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: rollupConfig.totalBuckets > 0,
    }
  );
}
