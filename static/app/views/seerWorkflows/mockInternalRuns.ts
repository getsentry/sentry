import type {WorkflowRow} from 'sentry/views/seerWorkflows/types';

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60_000).toISOString();

// Mock runs for the 2 internal strategies. Surfaced on the runs page for
// Sentry employees only.
export const MOCK_INTERNAL_RUNS: WorkflowRow[] = [
  {
    id: 'mock-internal-duplicate-1:duplicate_issue_merger',
    runId: 'mock-internal-duplicate-1',
    dateAdded: hoursAgo(13),
    kind: 'duplicate_issue_merger',
    status: 'succeeded',
    source: 'cron',
    summary:
      'Found 8 candidate duplicate-issue pairs across 4 projects. Auto-merged 3 high-confidence pairs (>0.95); flagged 5 lower-confidence pairs for manual review on each affected issue.',
    resultText: '3 merged · 5 flagged',
    triage: {issues: [], agentRunId: 9201},
  },
  {
    id: 'mock-internal-ownership-1:ownership_suggester',
    runId: 'mock-internal-ownership-1',
    dateAdded: daysAgo(2),
    kind: 'ownership_suggester',
    status: 'succeeded',
    source: 'cron',
    summary:
      'Reviewed 142 issues resolved in the last week. Proposed 6 new Ownership rules based on consistent author patterns — visible under Project Settings → Ownership → Suggested rules.',
    resultText: '6 rules proposed',
    triage: {issues: [], agentRunId: 9202},
  },
];
