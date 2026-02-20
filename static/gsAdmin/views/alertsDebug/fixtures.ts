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
  organizationId: 'sentry',
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

/**
 * Log entry type for workflow logs testing.
 */
export interface LogEntry {
  [key: string]: unknown;
  id: string;
  message: string;
  severity: string;
  timestamp: string;
  event_id?: string;
  group_id?: string;
  trace?: string;
  workflow_ids?: string;
}

/**
 * Creates a mock LogEntry for testing workflow logs.
 */
export function LogEntryFixture(params: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    message: 'workflow_engine.process_workflows.evaluation.start',
    severity: 'info',
    timestamp: '2024-01-15T10:30:00.000Z',
    trace: 'trace-abc123',
    workflow_ids: '123',
    group_id: 'group-1',
    event_id: 'event-1',
    ...params,
  };
}

/**
 * Mock logs for testing WorkflowLogs component.
 */
export const MOCK_LOGS: LogEntry[] = [
  LogEntryFixture({id: 'log-1', severity: 'info'}),
  LogEntryFixture({
    id: 'log-2',
    message: 'workflow_engine.process_workflows.evaluation.error',
    severity: 'error',
    timestamp: '2024-01-15T10:29:00.000Z',
  }),
  LogEntryFixture({
    id: 'log-3',
    message: 'workflow_engine.process_workflows.evaluation.warning',
    severity: 'warning',
    timestamp: '2024-01-15T10:28:00.000Z',
  }),
];

/**
 * Grouped log entry type for workflow logs aggregation.
 */
export interface GroupedLogEntry {
  [key: string]: unknown;
  'count(message)': number;
  message: string;
}

/**
 * Creates a mock GroupedLogEntry for testing grouped workflow logs.
 */
export function GroupedLogEntryFixture(
  params: Partial<GroupedLogEntry> = {}
): GroupedLogEntry {
  return {
    message: 'workflow_engine.process_workflows.evaluation.start',
    'count(message)': 10,
    ...params,
  };
}

/**
 * Mock grouped logs for testing WorkflowLogs component in grouped view.
 */
export const MOCK_GROUPED_LOGS: GroupedLogEntry[] = [
  GroupedLogEntryFixture({
    message: 'workflow_engine.process_workflows.evaluation.start',
    'count(message)': 15,
  }),
  GroupedLogEntryFixture({
    message: 'workflow_engine.process_workflows.evaluation.condition_check',
    'count(message)': 8,
  }),
  GroupedLogEntryFixture({
    message: 'workflow_engine.process_workflows.evaluation.action_triggered',
    'count(message)': 3,
  }),
];
