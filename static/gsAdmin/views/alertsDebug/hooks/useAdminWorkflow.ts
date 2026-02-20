import type {Automation} from 'sentry/types/workflowEngine/automations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

/**
 * Hook to fetch workflow data via the organization workflow API.
 * Requires organization slug or ID alongside the workflow ID.
 */
export function useAdminWorkflow(
  organizationIdOrSlug: string | undefined,
  workflowId: string | undefined
) {
  const url = getApiUrl(`/customers/${organizationIdOrSlug}/workflows/${workflowId}/`, {
    path: {
      organizationIdOrSlug: organizationIdOrSlug ?? '',
      workflowId: workflowId ?? '',
    },
  });

  return useApiQuery<Automation>([url], {
    staleTime: 0,
    enabled: !!organizationIdOrSlug && !!workflowId,
    retry: 0,
  });
}
