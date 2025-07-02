import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import {
  type DataConditionHandler,
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export function DataConditionHandlerFixture(
  params: Partial<DataConditionHandler> = {}
): DataConditionHandler {
  return {
    type: DataConditionType.AGE_COMPARISON,
    handlerGroup: DataConditionHandlerGroupType.ACTION_FILTER,
    handlerSubgroup: DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES,
    comparisonJsonSchema: {},
    ...params,
  };
}

export function ActionHandlerFixture(params: Partial<ActionHandler> = {}): ActionHandler {
  return {
    configSchema: {},
    dataSchema: {},
    handlerGroup: ActionGroup.NOTIFICATION,
    type: ActionType.SLACK,
    integrations: [{id: '1', name: 'My Slack Workspace'}],
    ...params,
  };
}
