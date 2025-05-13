import type {
  DataCondition,
  DataConditionGroup,
  NewDataCondition,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export function DataConditionFixture(params: Partial<NewDataCondition>): DataCondition {
  return {
    type: DataConditionGroupLogicType.ALL,
    comparison_type: DataConditionType.EQUAL,
    comparison: '8',
    id: '1',
    ...params,
  };
}

export function DataConditionGroupFixture(
  params: Partial<DataConditionGroup>
): DataConditionGroup {
  return {
    conditions: [DataConditionFixture({})],
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    actions: [],
    ...params,
  };
}
