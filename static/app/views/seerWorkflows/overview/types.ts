import type {Level} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';

export type AutofixOutcome = 'root_cause' | 'solution' | 'code_changes' | 'pr_opened';

export type AutofixRunStatus = 'COMPLETED' | 'ERROR' | 'NEED_MORE_INFORMATION';

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

export interface CompletedAutofixIssue {
  autofixCompletedAt: string;
  autofixRunStatus: AutofixRunStatus;
  eventCount: number;
  id: string;
  lastSeen: string;
  level: Level;
  outcomes: AutofixOutcome[];
  project: {platform: PlatformKey; slug: string};
  shortId: string;
  title: string;
  trigger: AutofixTrigger;
  userCount: number;
  prMerged?: boolean;
  prUrl?: string;
}
