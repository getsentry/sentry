import type {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useDetectorQueriesByIds} from 'sentry/views/detectors/hooks';

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

export function useAutomationProjectIds(automation: Automation): string[] {
  const queries = useDetectorQueriesByIds(automation.detectorIds);
  return [
    ...new Set(queries.map(query => query.data?.projectId).filter(x => x)),
  ] as string[];
}
