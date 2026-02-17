import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useApiQuery} from 'sentry/utils/queryClient';

/**
 * Hook to fetch workflow data via the internal admin API.
 * This is only accessible to superusers.
 */
export function useAdminWorkflow(workflowId: string | undefined) {
  return useApiQuery<Automation>([`/internal/workflows/${workflowId}/`], {
    staleTime: 0,
    enabled: !!workflowId,
  });
}
