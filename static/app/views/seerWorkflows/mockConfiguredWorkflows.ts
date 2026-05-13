import type {ConfiguredWorkflow, WorkflowKind} from 'sentry/views/seerWorkflows/types';

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60_000).toISOString();

export const MOCK_CONFIGURED_WORKFLOWS: ConfiguredWorkflow[] = [
  {
    id: 'mock-cfg-agentic-daily',
    strategy: 'agentic_triage',
    frequency: 'daily',
    notification: 'slack',
    lastRunAt: hoursAgo(9),
  },
  {
    id: 'mock-cfg-autofix-followup-daily',
    strategy: 'autofix_followup',
    frequency: 'daily',
    notification: 'slack',
    lastRunAt: hoursAgo(6),
  },
  {
    id: 'mock-cfg-feedback-hourly',
    strategy: 'feedback_summary',
    frequency: 'hourly',
    notification: 'email',
    lastRunAt: minutesAgo(34),
  },
  {
    id: 'mock-cfg-replay-friction-daily',
    strategy: 'replay_friction_finder',
    frequency: 'daily',
    notification: 'slack',
    lastRunAt: hoursAgo(7),
  },
  {
    id: 'mock-cfg-release-regression-daily',
    strategy: 'release_regression_scout',
    frequency: 'daily',
    notification: 'email',
    lastRunAt: hoursAgo(11),
  },
  {
    id: 'mock-cfg-perf-regression-weekly',
    strategy: 'performance_regression_scout',
    frequency: 'weekly',
    notification: 'none',
    lastRunAt: daysAgo(3),
  },
  {
    id: 'mock-cfg-cron-doctor-weekly',
    strategy: 'cron_monitor_doctor',
    frequency: 'weekly',
    notification: 'none',
    lastRunAt: daysAgo(5),
  },
];

// Internal strategies are rendered straight from STRATEGY_META; this map
// provides their mock last-run timestamps for the configure page.
export const MOCK_INTERNAL_LAST_RUNS: Partial<Record<WorkflowKind, string>> = {
  duplicate_issue_merger: hoursAgo(13),
  ownership_suggester: daysAgo(2),
};
