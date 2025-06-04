import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

function DataConditionFixture(params: Partial<DataCondition> = {}): DataCondition {
  return {
    type: DataConditionType.EQUAL,
    comparison: '8',
    id: '1',
    ...params,
  };
}

export function DataConditionGroupFixture(
  params: Partial<DataConditionGroup> = {}
): DataConditionGroup {
  return {
    conditions: [DataConditionFixture()],
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    actions: [],
    ...params,
  };
}
