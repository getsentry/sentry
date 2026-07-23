import type {Actor} from 'sentry/types/core';
import type {Level} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
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

// Toolbar controls, persisted in the URL (sort) and localStorage (view).
export type SortValue = 'activity' | 'events';
export type OverviewView = 'cards' | 'table';

// Live run status, mirrored straight from ExplorerAutofixState.status. Drives
// the transient card overlays (Running / Retry / Add context), never the
// section-driven primary action.
export type RunStatus = 'processing' | 'completed' | 'error' | 'awaiting_user_input';

// The primary action a card offers, derived from its section. review_pr carries
// the linked PR so it can offer the external review button.
export type CardAction =
  | {prNumber: number | undefined; prUrl: string | undefined; type: 'review_pr'}
  | {type: 'code_changes_ready'}
  | {type: 'solution_ready'}
  | {type: 'needs_investigation'}
  | {type: 'merged'};

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
  lastSeen: string;
  level: Level;
  project: {id: string; slug: string; platform?: PlatformKey};
  seerAutofixLastTriggered: string | null;
  shortId: string;
  title: string;
  userCount: number;
  owners?: Group['owners'];
}

// How the run was started. Sources without a mapping render a fallback
// badge with the raw source text.
export type AutofixTrigger =
  | 'manual'
  | 'issue_summary'
  | 'alert'
  | 'post_process'
  | 'night_shift';

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
  assignedTo: Actor | null;
  eventCount: number;
  id: string;
  // Most recent Seer activity on the run (state update, trigger, or
  // issue-level last-trigger timestamp); null when the run has no Seer-side
  // timestamp, which hides the card's Seer-activity TimeSince.
  lastActivityAt: string | null;
  // When the issue's most recent event occurred; labels the card's
  // "last seen" TimeSince.
  lastSeen: string;
  level: Level;
  project: {id: string; slug: string; platform?: PlatformKey};
  // Live run status, mirrored straight from the state payload; drives the
  // transient overlays only. Null until the state request resolves.
  runStatus: RunStatus | null;
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
  owners?: Group['owners'];
  patchStats?: PatchStats;
  // The question autofix paused on, when status is NEED_MORE_INFORMATION and
  // the pending input payload carries readable text.
  pendingQuestion?: string;
  prNumber?: number;
  prUrl?: string;
  rawSource?: string | null;
  trigger?: AutofixTrigger | null;
}
