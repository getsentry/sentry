import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseAutomationsQueryOptions {
  query?: string;
  sort?: string;
}
export function useAutomationsQuery(_options: UseAutomationsQueryOptions = {}) {
  const {slug} = useOrganization();

  return useApiQuery<Automation[]>(makeAutomationsQueryKey(slug), {
    staleTime: 0,
    retry: false,
  });
}
const makeAutomationsQueryKey = (orgSlug: string): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/`,
];

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useApiQuery<ActionHandler[]>([`/organizations/${slug}/available-actions/`], {
    staleTime: Infinity,
    retry: false,
  });
}
