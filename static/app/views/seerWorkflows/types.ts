type SeerNightShiftRunIssue = {
  action: string;
  dateAdded: string;
  groupId: string;
  id: string;
  seerRunId: string | null;
};

type SeerNightShiftRunOptions = {
  dry_run?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  source?: string;
};

type SeerNightShiftRunExtras = {
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

export type WorkflowKind = 'agentic_triage';

export type StrategyVisibility = 'configurable' | 'internal';
export type StrategyCategory = 'issues' | 'reliability' | 'user_experience';
export type RunStatus = 'succeeded' | 'failed' | 'skipped' | 'running';

export type Frequency = 'hourly' | 'daily' | 'weekly';

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

export type WorkflowRow = {
  dateAdded: string;
  id: string;
  kind: WorkflowKind;
  runId: string;
  status: RunStatus;
  errorMessage?: string | null;
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
