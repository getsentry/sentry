export type SeerNightShiftRunIssue = {
  action: string;
  dateAdded: string;
  groupId: string;
  id: string;
  seerRunId: string | null;
};

export type SeerNightShiftRunOptions = {
  dry_run?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  source?: string;
};

export type SeerNightShiftRunExtras = {
  agent_run_id?: number | string;
  options?: SeerNightShiftRunOptions;
  target_project_ids?: number[];
  triggering_user_id?: number;
};

export type SeerNightShiftRun = {
  dateAdded: string;
  errorMessage: string | null;
  extras: SeerNightShiftRunExtras;
  id: string;
  issues: SeerNightShiftRunIssue[];
  triageStrategy: string;
};

export type WorkflowKind =
  | 'agentic_triage'
  | 'feedback_summary'
  | 'autofix_followup'
  | 'release_regression_scout'
  | 'performance_regression_scout'
  | 'replay_friction_finder'
  | 'alert_tuning_advisor'
  | 'cron_monitor_doctor'
  | 'duplicate_issue_merger'
  | 'ownership_suggester';

export type StrategyVisibility = 'configurable' | 'internal';
export type StrategyCategory = 'issues' | 'reliability' | 'user_experience';
export type RunStatus = 'succeeded' | 'failed' | 'skipped' | 'running';

export type FeedbackTheme = {
  description: string;
  feedbackGroupIds: number[];
  title: string;
};

export type Frequency = 'hourly' | 'daily' | 'weekly';

export type NotificationChannel = 'slack' | 'email' | 'none';

export type OutputId =
  | 'autofix_runs'
  | 'issue_activity'
  | 'release_annotation'
  | 'performance_annotation'
  | 'replay_collection'
  | 'alert_rule_suggestion'
  | 'monitor_annotation'
  | 'merge_proposal'
  | 'ownership_suggestion'
  | 'notification';

export type ConfiguredWorkflow = {
  frequency: Frequency;
  id: string;
  notification: NotificationChannel;
  strategy: WorkflowKind;
  lastRunAt?: string;
};

export type WorkflowRow = {
  dateAdded: string;
  id: string;
  kind: WorkflowKind;
  runId: string;
  status: RunStatus;
  errorMessage?: string | null;
  feedback?: {
    numFeedbacksAnalyzed: number;
    summary: string;
    themes: FeedbackTheme[];
    agentRunId?: number | string;
    reason?: 'insufficient_feedbacks';
  };
  options?: SeerNightShiftRunOptions;
  resultText?: string;
  source?: string;
  summary?: string;
  triage?: {
    issues: SeerNightShiftRunIssue[];
    agentRunId?: number | string;
    dryRun?: boolean;
    maxCandidates?: number;
  };
};
