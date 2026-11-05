import {useQuery} from '@tanstack/react-query';

import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
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
}

type Result = Record<string, MonitorBucket[]>;

/**
 * Fetches Monitor stats
 */
export function useMonitorStats({monitors, timeWindowConfig}: Options) {
  const {start, end, rollupConfig} = timeWindowConfig;

  const selectionQuery = {
    since: Math.floor(start.getTime() / 1000),
    until: Math.floor(end.getTime() / 1000),
    resolution: `${rollupConfig.interval}s`,
  };

  const organization = useOrganization();
  const location = useLocation();

  return useQuery({
    ...apiOptions.as<Result>()('/organizations/$organizationIdOrSlug/monitors-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        monitor: monitors,
        project: location.query.project,
        environment: location.query.environment,
        ...selectionQuery,
      },
      staleTime: 0,
    }),
    enabled: rollupConfig.totalBuckets > 0,
    retry: false,
  });
}
