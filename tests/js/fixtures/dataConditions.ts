import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';

function DataConditionFixture(params: Partial<DataCondition> = {}): DataCondition {
  return {
    type: DataConditionType.GREATER,
    comparison: '8',
    id: '1',
    conditionResult: DetectorPriorityLevel.HIGH,
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
