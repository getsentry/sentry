import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
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

  return useApiQuery<Record<string, UptimeSummary>>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/uptime-summary/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          uptimeDetectorId: detectorIds,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );
}
