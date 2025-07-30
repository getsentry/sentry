import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

interface Options {
  /**
   * The list of uptime monitor IDs to fetch summaries for. These are the numeric
   * IDs of the UptimeRule id's
   */
  ruleIds: string[];
  /**
   * The window configuration object
   */
  timeWindowConfig: TimeWindowConfig;
}

/**
 * Fetches Uptime Monitor summaries
 */
export function useUptimeMonitorSummaries({ruleIds, timeWindowConfig}: Options) {
  const {start, end} = timeWindowConfig;

  const selectionQuery = {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };

  const organization = useOrganization();
  const monitorStatsQueryKey = `/organizations/${organization.slug}/uptime-summary/`;

  return useApiQuery<Record<string, UptimeSummary>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          projectUptimeSubscriptionId: ruleIds,
          ...selectionQuery,
        },
      },
    ],
    {staleTime: 0}
  );
}
