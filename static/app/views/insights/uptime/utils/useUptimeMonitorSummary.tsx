import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {UptimeSummary} from 'sentry/views/detectors/components/uptime/types';

interface Options {
  /**
   * The list of uptime monitor IDs to fetch summaries for. These are the numeric
   * IDs of the UptimeRule id's
   */
  detectorIds: string[];
}

/**
 * Fetches Uptime Monitor summaries
 */
export function useUptimeMonitorSummaries({detectorIds}: Options) {
  const organization = useOrganization();

  return useQuery(
    apiOptions.as<Record<string, UptimeSummary>>()(
      '/organizations/$organizationIdOrSlug/uptime-summary/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          uptimeDetectorId: detectorIds,
        },
        staleTime: 0,
      }
    )
  );
}
