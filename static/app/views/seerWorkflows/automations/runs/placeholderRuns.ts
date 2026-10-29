// TEMPORARY: placeholder data for trying the runs list until the new runs API ships
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

// Turned off in tests so they exercise the runs API
export const USE_PLACEHOLDER_RUNS = true;

const MINUTE = 60 * 1000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

function execution(
  id: string,
  minutesAgo: number,
  status: 'queued' | 'running' | 'complete' | null,
  seerRunId: string | null = null
) {
  return {
    id,
    status,
    seerRunId,
    dateAdded: ago(minutesAgo),
    dateUpdated: ago(minutesAgo - 1),
    dateCompleted: status === 'complete' ? ago(minutesAgo - 2) : null,
  };
}

export const PLACEHOLDER_RUNS: SeerAutomationRun[] = [
  {
    id: '1008',
    configId: 'placeholder-triage',
    strategy: 'agentic_triage_v2',
    status: 'running',
    dateAdded: ago(1),
    dateUpdated: ago(0),
    dateCompleted: null,
    executions: [
      execution('5101', 1, 'complete', '9001'),
      execution('5102', 1, 'running', '9002'),
    ],
  },
  {
    id: '1007',
    configId: 'placeholder-metrics',
    strategy: 'breached_metrics',
    status: 'queued',
    dateAdded: ago(3),
    dateUpdated: ago(3),
    dateCompleted: null,
    executions: [],
  },
  {
    id: '1006',
    configId: 'placeholder-triage',
    strategy: 'agentic_triage_v2',
    status: 'complete',
    dateAdded: ago(90),
    dateUpdated: ago(85),
    dateCompleted: ago(85),
    executions: [
      execution('5091', 90, 'complete', '8991'),
      execution('5092', 89, 'complete', '8992'),
      execution('5093', 88, 'complete'),
    ],
  },
  {
    id: '1005',
    configId: 'placeholder-triage',
    strategy: 'agentic_triage_v2',
    status: 'failed',
    error: {code: 'seer_unavailable', message: 'Seer was unavailable. Try again later.'},
    dateAdded: ago(60 * 5),
    dateUpdated: ago(60 * 5 - 2),
    dateCompleted: ago(60 * 5 - 2),
    executions: [
      {
        id: '5081',
        status: 'failed',
        error: {code: 'timeout', message: 'The agent timed out after 10 minutes.'},
        seerRunId: '8981',
        dateAdded: ago(60 * 5),
        dateUpdated: ago(60 * 5 - 2),
        dateCompleted: ago(60 * 5 - 2),
      },
    ],
  },
  {
    id: '1004',
    configId: 'placeholder-metrics',
    strategy: 'breached_metrics',
    status: 'rejected',
    error: {
      code: 'budget_exceeded',
      message: 'This automation is over its monthly budget.',
    },
    dateAdded: ago(60 * 26),
    dateUpdated: ago(60 * 26),
    dateCompleted: ago(60 * 26),
    executions: [],
  },
  {
    id: '1003',
    configId: 'placeholder-metrics',
    strategy: 'breached_metrics',
    status: 'complete',
    dateAdded: ago(60 * 24 * 3),
    dateUpdated: ago(60 * 24 * 3 - 5),
    dateCompleted: ago(60 * 24 * 3 - 5),
    executions: [],
  },
  {
    id: '1002',
    configId: 'placeholder-triage',
    strategy: 'agentic_triage_v2',
    status: null,
    dateAdded: ago(60 * 24 * 10),
    dateUpdated: ago(60 * 24 * 10),
    dateCompleted: null,
    executions: [execution('5011', 60 * 24 * 10, null, '8811')],
  },
  {
    id: '1001',
    configId: 'placeholder-metrics',
    strategy: 'breached_metrics',
    status: 'complete',
    dateAdded: ago(60 * 24 * 40),
    dateUpdated: ago(60 * 24 * 40),
    dateCompleted: ago(60 * 24 * 40),
    executions: [execution('5001', 60 * 24 * 40, 'complete')],
  },
];
