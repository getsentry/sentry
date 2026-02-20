import type {BaseGroupSerializerResponse} from 'sentry/api-docs/generated/sentry.types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface DetectorResponse {
  id: number;
  name: string;
}

export interface WorkflowFireHistoryEntry {
  count: number;
  eventId: string;
  group: BaseGroupSerializerResponse;
  lastTriggered: string;
  detector?: DetectorResponse;
  notificationUuid?: string;
}

export interface WorkflowFireHistoryOptions {
  cursor?: string;
  end?: string;
  start?: string;
  statsPeriod?: string;
}

/**
 * Hook to fetch workflow fire history from the group-history endpoint.
 * Returns fire history aggregated by group, showing count, last triggered time,
 * and the event ID from the last fire.
 *
 * @param organizationIdOrSlug - The organization ID or slug
 * @param workflowId - The workflow ID to fetch history for
 * @param options - Time filtering and pagination options
 */
export function useWorkflowFireHistory(
  organizationIdOrSlug: string | undefined,
  workflowId: number | undefined,
  options?: WorkflowFireHistoryOptions
): ReturnType<typeof useApiQuery<WorkflowFireHistoryEntry[]>> {
  const {statsPeriod, start, end, cursor} = options ?? {};

  // Build time filter params - use statsPeriod OR start/end, not both
  const timeParams = statsPeriod
    ? {statsPeriod}
    : start && end
      ? {start, end}
      : {statsPeriod: '24h'}; // Default fallback

  return useApiQuery<WorkflowFireHistoryEntry[]>(
    [
      `/organizations/${organizationIdOrSlug}/workflows/${workflowId}/group-history/`,
      {
        query: {
          per_page: 10,
          cursor,
          ...timeParams,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!organizationIdOrSlug && !!workflowId,
    }
  );
}
