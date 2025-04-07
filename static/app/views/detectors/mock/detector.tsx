import moment from 'moment-timezone';

import type {Detector} from 'sentry/types/detectors';
import {
  ActionType,
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/detectors';
import {PriorityLevel} from 'sentry/types/group';

export const mockDetectors: Detector[] = [
  {
    id: 'abc123',
    projectId: 'js-astro',
    name: 'Test Detector',
    lastTriggered: moment().subtract(1, 'days').toDate(),
    workflowIds: ['workflow1', 'workflow2'],
    disabled: false,
    type: 'metric',
    dateCreated: moment().subtract(1, 'days').toDate(),
    dateUpdated: moment().subtract(1, 'hours').toDate(),
    dataSource: {
      id: 'def456',
      status: 1,
      snubaQuery: {
        aggregate: 'count()',
        dataset: 'events',
        id: 'mno345',
        query: 'hello',
        timeWindow: 60,
      },
    },
    dataCondition: {
      id: 'pqr678',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        {
          comparison: 100,
          condition_result: PriorityLevel.MEDIUM,
          comparison_type: DataConditionType.GREATER,
        },
      ],
      actions: [
        {
          id: 'act123',
          type: ActionType.EMAIL,
          data: {},
        },
      ],
    },
    config: {},
    detectorType: 'metric',
  },
];
