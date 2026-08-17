import type {Actor} from 'sentry/types/core';
import type {Level} from 'sentry/types/event';
import type {Group, PriorityLevel} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/platform';

// Shared staleTime for the overview's issue/run/state queries.
export const QUERY_STALE_TIME = 30_000;

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
export interface PipelineStage {
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

export const SECTION_ORDER: AutofixStateKey[] = PIPELINE.map(stage => stage.key);

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
