import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseAutomationsQueryOptions {
  query?: string;
  sort?: string;
}
export function useAutomationsQuery(_options: UseAutomationsQueryOptions = {}) {
  const {slug} = useOrganization();

  return useApiQuery<Automation[]>(makeAutomationQueryKey(slug), {
    staleTime: 0,
    retry: false,
  });
}
const makeAutomationQueryKey = (orgSlug: string, automationId = ''): [url: string] => [
  `/organizations/${orgSlug}/workflows/${automationId ? `${automationId}/` : ''}/`,
];

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useApiQuery<ActionHandler[]>([`/organizations/${slug}/available-actions/`], {
    staleTime: Infinity,
    retry: false,
  });
}
