import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export const MOCK_WORKFLOW: Automation = {
  id: '1234',
  name: 'Mock Alert',
  createdBy: 'Josh',
  dateCreated: Date.now().toLocaleString(),
  dateUpdated: Date.now().toLocaleString(),
  lastTriggered: Date.now().toLocaleString(),
  config: {
    frequency: 10,
  },
  detectorIds: ['33', '732', '8'],
  enabled: true,
  environment: 'DEBUGGING -- TEST FIXTURE',
  actionFilters: [
    {
      id: 'mock-action-filter',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          id: 'Condition 1',
          comparison: 10,
          type: DataConditionType.EVENT_FREQUENCY_COUNT,
          conditionResult: true,
        },
        {
          id: 'Condition 2',
          comparison: 100,
          type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
          conditionResult: true,
        },
      ],
    },
    {
      id: 'mock-action-filter',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          id: 'Condition 1',
          comparison: 10,
          type: DataConditionType.EVENT_FREQUENCY_COUNT,
          conditionResult: true,
        },
        {
          id: 'Condition 2',
          comparison: 100,
          type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
          conditionResult: true,
        },
      ],
    },
  ],
  triggers: {
    id: 'mock-data-condition-group',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: 'mock-data-condition',
        comparison: 'comparison',
        type: DataConditionType.GREATER_OR_EQUAL,
        conditionResult: 75,
      },
    ],
  },
};
