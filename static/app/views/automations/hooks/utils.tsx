import type {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface UseAutomationsQueryOptions {
  query?: string;
  sort?: string;
}
export function useAutomationsQuery(_options: UseAutomationsQueryOptions = {}) {
  const {slug} = useOrganization();

  return useApiQuery<Automation[]>([`/organizations/${slug}/workflows/`], {
    staleTime: 0,
    retry: false,
  });
}

export function useAutomationActions(automation: Automation): ActionType[] {
  return [
    ...new Set(
      automation.actionFilters
        .flatMap(dataConditionGroup =>
          dataConditionGroup.actions?.map(action => action.type)
        )
        .filter(x => x)
    ),
  ] as ActionType[];
}
