import type {FilePatch} from 'sentry/components/events/autofix/types';
import type {Level} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

// Shared staleTime for the overview's issue/run/state queries.
export const QUERY_STALE_TIME = 30_000;

// Runs filter: the explorer runs autofix creates. Combined with a
// ``group:[...]`` filter so we only fetch runs for the issues on the page.
export const RUNS_QUERY = 'type:explorer source:autofix';

// Always applied to the issue query: only issues Seer has run autofix on.
export const REQUIRED_ISSUE_FILTER = 'has:issue.seer_last_run';

// One answered question, mirrors the run output in
// src/sentry/api/serializers/models/seer_run.py
export interface RunQuestion {
  answer: string;
  key: string;
  // The question text, echoed back only for user-supplied questions.
  question?: string;
}

// A pull request linked to a run, serialized by PullRequestSerializer
// src/sentry/api/serializers/models/pullrequest.py
// `status` is 'open' | 'merged' | 'closed' | 'draft' | 'unknown'.
export interface RunPullRequest {
  status: string | null;
  mergedAt?: string | null;
}

// Subset of the runs list response we consume
// src/sentry/api/serializers/models/seer_run.py
export interface SeerRun {
  groupId: string | null;
  id: string;
  lastTriggeredAt: string;
  source: string | null;
  // Present only when ?outputs is requested.
  outputs?: RunQuestion[];
  // Linked PRs with merge status.
  pullRequests?: RunPullRequest[];
}

// One issue from the issue stream, as the overview cards consume it.
export interface OverviewIssue {
  // Event count over the stats period; the endpoint returns it as a string.
  count: string;
  id: string;
  lastSeen: string;
  level: Level;
  project: {slug: string; platform?: PlatformKey};
  seerAutofixLastTriggered: string | null;
  shortId: string;
  title: string;
  userCount: number;
}

export type AutofixOutcome = 'root_cause' | 'solution' | 'code_changes' | 'pr_opened';

// Run status buckets mapped from ExplorerAutofixState.status; 'processing' maps
// to SETTLED with isProcessing set on the row.
export type AutofixRunStatus = 'SETTLED' | 'ERROR' | 'NEED_MORE_INFORMATION';

// How the run was started. Sources without a mapping render a fallback
// badge with the raw source text.
export type AutofixTrigger =
  | 'manual'
  | 'issue_summary'
  | 'alert'
  | 'post_process'
  | 'night_shift';

export type AttentionReason =
  | 'awaiting_input'
  | 'solution_ready'
  | 'code_changes_ready'
  | 'review_pr'
  | 'errored';

// One answered run question joined to its question config
// See ./runQuestions.ts
export interface RunAnalysisEntry {
  answer: string;
  key: string;
  label: string;
}

// One changed file within the run's drafted diff.
interface PatchFile {
  added: number;
  // Prefixed with "repo:" only when the diff spans more than one repository.
  path: string;
  removed: number;
}

// Aggregate stats over the run's merged file patches.
export interface PatchStats {
  added: number;
  // Per-file breakdown, sorted by churn (added+removed) descending.
  fileList: PatchFile[];
  files: number;
  removed: number;
}

// One issue + its latest autofix run, flattened for the overview cards.
export interface OverviewRow {
  analysis: RunAnalysisEntry[];
  autofixRunStatus: AutofixRunStatus;
  eventCount: number;
  id: string;
  // Most recent activity on the run (state update, trigger, or issue-level
  // last-trigger timestamp) - drives sorting and the period filter.
  lastActivityAt: string;
  level: Level;
  outcomes: AutofixOutcome[];
  prMerged: boolean;
  project: {slug: string; platform?: PlatformKey};
  shortId: string;
  // Whether the per-issue autofix state request is still in flight.
  statePending: boolean;
  // The stats period the event/user counts were fetched over; labels the
  // count tooltip so it matches the active period filter.
  statsPeriod: string;
  title: string;
  userCount: number;
  // Plain-language title from the run's root-cause answer (see runQuestions).
  // Falls back to the raw issue title.
  headline?: string;
  // Structured patches for the on-card differ; present only when the diff is
  // small enough to render inline (see the INLINE_DIFF_* limits in
  // buildOverviewRows).
  inlinePatches?: Array<{patch: FilePatch; repoName?: string}>;
  isProcessing?: boolean;
  patchStats?: PatchStats;
  // The question autofix paused on, when status is NEED_MORE_INFORMATION and
  // the pending input payload carries readable text.
  pendingQuestion?: string;
  prNumber?: number;
  prUrl?: string;
  rawSource?: string | null;
  trigger?: AutofixTrigger | null;
}
