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
