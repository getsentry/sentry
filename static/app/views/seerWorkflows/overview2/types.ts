import type {Actor} from 'sentry/types/core';
import type {Level} from 'sentry/types/event';
import type {
  IssueCategory,
  IssueType,
  PriorityLevel,
  SuggestedOwner,
} from 'sentry/types/group';
import type {
  PullRequestChecksStatus,
  PullRequestReviewStatus,
  PullRequestStatus,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/platform';
import {
  type AutofixStateKey,
  SECTION_ORDER,
} from 'sentry/views/seerWorkflows/overview/types';

export const QUERY_STALE_TIME = 30_000;

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

export const OVERVIEW2_SECTIONS: Array<{
  key: AutofixStateKey;
  milestone: MilestoneKey;
}> = SECTION_ORDER.map(key => ({
  key,
  milestone: MILESTONE_BY_SECTION[key],
}));

export interface OverviewPullRequestFile {
  additions: number;
  changeType: string;
  deletions: number;
  path: string;
}

export interface OverviewPullRequest {
  checksStatus: PullRequestChecksStatus | null;
  files: OverviewPullRequestFile[];
  number: number;
  reviewStatus: PullRequestReviewStatus | null;
  status: PullRequestStatus | null;
  url: string | null;
}

// Issue-side facts the endpoint serializes off the Group; mirrors the fields the
// reused priority/assignee widgets and the vitals row consume.
export interface OverviewRunIssue {
  assignedTo: Actor | null;
  count: string;
  issueCategory: IssueCategory;
  issueType: IssueType;
  lastSeen: string;
  level: Level;
  owners: SuggestedOwner[];
  priority: PriorityLevel | null;
  priorityLockedAt: string | null;
  project: {id: string; slug: string; platform?: PlatformKey};
  substatus: string | null;
  userCount: number;
}

// One autofix run, as serialized by the autofix-overview endpoint.
export interface OverviewRun {
  groupId: string;
  issue: OverviewRunIssue;
  lastTriggeredAt: string;
  proposedFix: {oneLineSummary: string | null} | null;
  pullRequests: OverviewPullRequest[];
  rootCause: {oneLineDescription: string | null} | null;
  seerRunId: string;
  shortId: string;
  title: string;
}

export interface AutofixOverviewResponse {
  runsByMilestone: Record<MilestoneKey, OverviewRun[]>;
}
