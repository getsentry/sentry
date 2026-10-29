export type WorkflowStrategy =
  | 'agentic_triage'
  | 'agentic_triage_v2'
  | 'breached_metrics'
  | 'duplicate_monitors';

type SeerWorkflowError = {
  code: string;
  message: string;
};

/**
 * Null for historical rows recorded before run lifecycle tracking
 */
type SeerWorkflowActiveStatus = 'queued' | 'running' | 'complete' | null;

type SeerWorkflowExecutionBase = {
  dateAdded: string;
  dateCompleted: string | null;
  dateUpdated: string;
  id: string;
  seerRunId: string | null;
};

type SeerWorkflowExecution = SeerWorkflowExecutionBase &
  ({status: SeerWorkflowActiveStatus} | {error: SeerWorkflowError; status: 'failed'});

type SeerAutomationRunBase = {
  configId: string;
  dateAdded: string;
  dateCompleted: string | null;
  dateUpdated: string;
  executions: SeerWorkflowExecution[];
  id: string;
  strategy: string;
};

export type SeerAutomationRun = SeerAutomationRunBase &
  (
    | {status: SeerWorkflowActiveStatus}
    | {error: SeerWorkflowError; status: 'failed' | 'rejected'}
  );

export type SeerAutomationRunStatus = SeerAutomationRun['status'];

export type SeerAutomationRunsResponse = {
  runs: SeerAutomationRun[];
};

export type WorkflowDisplayStatus =
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'running'
  | 'partial';

export type SeerWorkflowConfigResponse = {
  dateAdded: string;
  dateUpdated: string;
  enabled: boolean;
  /**
   * Empty means all environments
   */
  environments: string[];
  filters: Record<string, unknown>;
  id: string;
  outputPolicy: Record<string, unknown>;
  /**
   * [-1] for all projects, [] for none, otherwise selected project IDs
   */
  projects: number[];
  schedule: string;
  seededDefault: string | null;
  strategy: string;
  version: number;
  /**
   * When the latest visible run started. Omitted if there are none
   */
  dateLastRun?: string;
  /**
   * Status of the latest visible run. Omitted if there are none
   */
  lastRunStatus?: SeerAutomationRunStatus;
};

export type SeerWorkflowConfigsResponse = {
  configs: SeerWorkflowConfigResponse[];
};
