import type {Event} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
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
      id: 'mock-action-filter-1',
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
      id: 'mock-action-filter-2',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          id: 'Condition 3',
          comparison: 10,
          type: DataConditionType.EVENT_FREQUENCY_COUNT,
          conditionResult: true,
        },
        {
          id: 'Condition 4',
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

/**
 * Creates a mock Event for testing and development fallback.
 * Based on the Event type from sentry/types/event.
 */
export function EventFixture(params: Partial<Event> = {}): Event {
  return {
    id: '1',
    eventID: 'abc123',
    title: 'TypeError: Cannot read property "foo" of undefined',
    message: 'Cannot read property "foo" of undefined',
    dateCreated: '2024-01-15T10:30:00.000Z',
    dateReceived: '2024-01-15T10:30:00.000Z',
    platform: 'javascript',
    projectID: '1',
    groupID: '100',
    type: EventOrGroupType.ERROR,
    tags: [{key: 'browser', value: 'Chrome 120'}],
    metadata: {},
    entries: [],
    errors: [],
    crashFile: null,
    size: 0,
    dist: null,
    fingerprints: [],
    culprit: '',
    user: null,
    location: '',
    occurrence: null,
    resolvedWith: [],
    contexts: {},
    ...params,
  };
}

/**
 * Mock events for development when backend endpoint is not available.
 */
export const MOCK_EVENTS: Record<string, Event> = {
  abc123: EventFixture({eventID: 'abc123'}),
  def456: EventFixture({
    id: '2',
    eventID: 'def456',
    title: 'ValueError: Invalid input parameter',
    message: 'Invalid input parameter',
    platform: 'python',
    dateCreated: '2024-01-14T15:45:00.000Z',
    tags: [{key: 'environment', value: 'production'}],
  }),
  ghi789: EventFixture({
    id: '3',
    eventID: 'ghi789',
    title: 'NullPointerException in UserService',
    message: 'NullPointerException in UserService.getUser()',
    platform: 'java',
    dateCreated: '2024-01-13T09:20:00.000Z',
    tags: [{key: 'level', value: 'error'}],
  }),
};
