import type {FilePatch} from 'sentry/components/events/autofix/types';
import type {Actor} from 'sentry/types/core';
import type {Level} from 'sentry/types/event';
import type {
  Group,
  IssueCategory,
  IssueType,
  PriorityLevel,
  SuggestedOwner,
} from 'sentry/types/group';
import type {
  PullRequestChecksStatus,
  PullRequestFileChangeType,
  PullRequestReviewStatus,
  PullRequestStatus,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/platform';

// Shared staleTime for the overview's issue/run/state queries.
export const QUERY_STALE_TIME = 30_000;

// How often the `expand=status` poll refreshes live run status.
export const POLL_INTERVAL = 10_000;

export type RunStatus = 'processing' | 'completed' | 'error' | 'awaiting_user_input';

// Runs filter: the explorer runs autofix creates. Combined with a
// ``group:[...]`` filter so we only fetch runs for the issues on the page.
export const RUNS_QUERY = 'type:explorer source:autofix';

// Always applied to the issue query: only issues Seer has run autofix on.
export const REQUIRED_ISSUE_FILTER = 'has:issue.seer_last_run';

// The section an issue is bucketed into, from the ``issue.autofix_state``
// search key (server-authoritative) or, in focus mode, deriveSectionKey.
export type AutofixStateKey =
  | 'review_pr'
  | 'code_changes_ready'
  | 'solution_ready'
  | 'needs_investigation'
  | 'merged';

// One pipeline stage. `fill` is how many of the five checklist steps
// (root cause → plan → code → PR → merge) a card in this stage has reached; it
// is the single source of stage precedence, driving the section-header
// checklist and the focus-mode fallback (which walks stages furthest-first).
interface PipelineStage {
  fill: number;
  key: AutofixStateKey;
}

// The whole pipeline, in display order. Every hand-encoded stage ordering in
// the overview derives from this table.
export const PIPELINE: PipelineStage[] = [
  {key: 'review_pr', fill: 4},
  {key: 'code_changes_ready', fill: 3},
  {key: 'solution_ready', fill: 2},
  {key: 'needs_investigation', fill: 1},
  {key: 'merged', fill: 5},
];

const SECTION_ORDER: AutofixStateKey[] = PIPELINE.map(stage => stage.key);

// One answered question, mirrors the run output in
// src/sentry/api/serializers/models/seer_run.py
interface RunQuestion {
  answer: string;
  key: string;
  // The question text, echoed back only for user-supplied questions.
  question?: string;
}

// A pull request linked to a run, serialized by PullRequestSerializer
// src/sentry/api/serializers/models/pullrequest.py
// `status` is 'open' | 'merged' | 'closed' | 'draft' | 'unknown'.
interface RunPullRequest {
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
  assignedTo: Actor | null;
  // Event count over the stats period; the endpoint returns it as a string.
  count: string;
  id: string;
  issueCategory: Group['issueCategory'];
  issueType: Group['issueType'];
  lastSeen: string;
  level: Level;
  priority: PriorityLevel | null;
  priorityLockedAt: string | null;
  project: {id: string; slug: string; platform?: PlatformKey};
  seerAutofixLastTriggered: string | null;
  shortId: string;
  title: string;
  userCount: number;
  owners?: Group['owners'];
}

export type OverviewSort = 'recommended' | 'seer' | 'issue' | 'events' | 'users';

// The milestone a run reached, as keyed in the endpoint's `runsByMilestone`.
export type MilestoneKey =
  | 'autofix_root_cause'
  | 'autofix_solution'
  | 'autofix_code_changes'
  | 'has_pull_request'
  | 'pull_requests_merged';

// Layout is the frontend's: the endpoint groups by milestone, we decide which
// section each milestone renders into and in what order.
const MILESTONE_BY_SECTION: Record<AutofixStateKey, MilestoneKey> = {
  review_pr: 'has_pull_request',
  code_changes_ready: 'autofix_code_changes',
  solution_ready: 'autofix_solution',
  needs_investigation: 'autofix_root_cause',
  merged: 'pull_requests_merged',
};

export const OVERVIEW_SECTIONS: Array<{
  key: AutofixStateKey;
  milestone: MilestoneKey;
}> = SECTION_ORDER.map(key => ({
  key,
  milestone: MILESTONE_BY_SECTION[key],
}));

export interface OverviewPullRequestFile {
  additions: number;
  changeType: PullRequestFileChangeType | null;
  deletions: number;
  path: string;
}

interface FailedCheckDetail {
  name: string;
  url: string | null;
}

export interface OverviewPullRequest {
  checksStatus: PullRequestChecksStatus | null;
  files: OverviewPullRequestFile[];
  id: string;
  number: number;
  reviewStatus: PullRequestReviewStatus | null;
  status: PullRequestStatus | null;
  url: string | null;
  failedCheckDetails?: FailedCheckDetail[];
  repoName?: string | null;
}

export interface PullRequestFileDiff {
  patch: string | null;
  path: string;
}

export interface PullRequestFilesResponse {
  files: PullRequestFileDiff[];
}

export interface OverviewCodeChangeFile {
  patch: FilePatch;
  repoName: string;
}

// Issue-side facts the endpoint serializes off the Group; mirrors the fields the
// reused priority/assignee widgets and the vitals row consume.
export interface OverviewRunIssue {
  assignedTo: Actor | null;
  count: string | null;
  issueCategory: IssueCategory | null;
  issueType: IssueType | null;
  lastSeen: string | null;
  level: Level | null;
  owners: SuggestedOwner[];
  priority: PriorityLevel | null;
  priorityLockedAt: string | null;
  project: {
    id: string;
    slug: string;
    platform?: PlatformKey;
  };
  substatus: string | null;
  userCount: number | null;
}

export interface OverviewRun {
  groupId: string;
  issue: OverviewRunIssue;
  lastTriggeredAt: string;
  proposedFix: {oneLineSummary: string | null} | null;
  pullRequests: OverviewPullRequest[];
  rootCause: {oneLineDescription: string | null} | null;
  seerRunId: string;
  shortId: string;
  status: RunStatus | null;
  title: string;
  codeChanges?: OverviewCodeChangeFile[];
}

export interface ProjectConfig {
  hasReposConnected: boolean;
  id: string;
  slug: string;
  hasNonGithubRepo?: boolean;
}

export interface AutofixOverviewResponse {
  runsByMilestone: Record<MilestoneKey, OverviewRun[]>;
  projectConfig?: ProjectConfig[];
  truncatedMilestones?: MilestoneKey[];
}

export interface AutofixScmInfoResponse {
  scmInfoByRunId: Record<string, {pullRequests: OverviewPullRequest[]}>;
}

// PR-bearing runs are partitioned by render order into windows of this size; a
// card scrolling into view fetches its whole window and prefetches the next.
export const SCM_WINDOW_SIZE = 5;
