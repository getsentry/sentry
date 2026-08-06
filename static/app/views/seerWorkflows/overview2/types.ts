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

// One autofix run, as serialized by the autofix-overview endpoint.
export interface OverviewRun {
  groupId: string;
  lastTriggeredAt: string;
  proposedFix: {oneLineSummary: string | null} | null;
  rootCause: {oneLineDescription: string | null} | null;
  seerRunId: string;
  shortId: string;
  title: string;
}

export interface AutofixOverviewResponse {
  runsByMilestone: Record<MilestoneKey, OverviewRun[]>;
}
