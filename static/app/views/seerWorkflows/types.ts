import type {NightShiftRow} from 'sentry/views/seerWorkflows/nightShift';

export type WorkflowRunStatus = 'running' | 'complete' | 'partial' | 'failed';

export type SeerWorkflowRun = {
  dateAdded: string;
  dateCompleted: string | null;
  errorMessage: string | null;
  extras: {status?: WorkflowRunStatus};
  id: string;
  results: SeerWorkflowResult[];
  strategy: WorkflowStrategy;
  seerRunId?: string;
};

export type WorkflowStrategy = 'agentic_triage' | 'duplicate_monitors';

export type WorkflowRunCreateRequest = {
  strategy: WorkflowStrategy;
};

export type SeerWorkflowResult = {
  extras: unknown;
  id: string;
  kind: string;
  seerRunId: string | null;
};

export type StrategyVisibility = 'configurable' | 'internal';
export type StrategyCategory = 'issues' | 'reliability' | 'user_experience';
export type WorkflowRowStatus =
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'running'
  | 'partial';

export type WorkflowRow = {
  dateAdded: string;
  id: string;
  results: SeerWorkflowResult[];
  runId: string;
  status: WorkflowRowStatus;
  strategy: WorkflowStrategy;
  errorMessage?: string | null;
  resultText?: string;
  runStatus?: WorkflowRunStatus;
  seerRunId?: string;
  source?: string;
  summary?: string;
  triage?: NightShiftRow;
};
