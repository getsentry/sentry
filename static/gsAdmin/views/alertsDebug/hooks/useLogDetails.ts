import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';

import {DETAIL_FIELDS} from './useWorkflowLogs';

export interface LogDetails {
  [key: string]: unknown;
  id: string;
  message: string;
  severity: string;
  timestamp: string;
}

interface LogDetailsResponse {
  data: LogDetails[];
  meta?: {
    fields: Record<string, string>;
  };
}

/**
 * Hook to fetch detailed information for a specific log entry.
 * Used when expanding a log in the list view to show all available fields.
 *
 * @param logId - The unique ID of the log entry
 * @param timestamp - The timestamp of the log entry (used for time range filtering)
 * @param organizationId - The organization ID/slug
 */
export function useLogDetails(
  logId: string | undefined,
  timestamp: string | undefined,
  organizationId: string | undefined
) {
  // Create a narrow time window around the log's timestamp to efficiently query
  // We query +/- 1 minute from the log timestamp to ensure we capture it
  const getTimeRange = () => {
    if (!timestamp) {
      return {statsPeriod: '24h'};
    }
    const logTime = new Date(timestamp);
    const start = new Date(logTime.getTime() - 60 * 1000); // 1 min before
    const end = new Date(logTime.getTime() + 60 * 1000); // 1 min after
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const timeParams = getTimeRange();

  return useApiQuery<LogDetailsResponse>(
    [
      `/organizations/${organizationId}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.OURLOGS,
          field: DETAIL_FIELDS,
          per_page: 1,
          query: `id:"${logId}"`,
          sort: '-timestamp',
          ...timeParams,
          referrer: 'admin.alerts-debug.log-details',
        },
      },
    ],
    {
      staleTime: Infinity, // Log details don't change
      enabled: !!logId && !!timestamp && !!organizationId,
    }
  );
}
