export type WorkflowStrategy =
  | 'agentic_triage'
  | 'agentic_triage_v2'
  | 'breached_metric_investigation'
  | 'duplicate_monitors';

type SeerWorkflowError = {
  code: string;
  message: string;
};

/**
 * Something an execution produced, e.g. a linked investigation
 */
type ExecutionOutput = {
  id: string;
  title: string;
  type: 'investigation';
};

type SeerWorkflowExecutionBase = {
  dateAdded: string;
  dateCompleted: string | null;
  dateUpdated: string;
  id: string;
  outputs: ExecutionOutput[];
  seerRunId: string | null;
};

type SeerWorkflowExecution = SeerWorkflowExecutionBase &
  (
    | {
        /**
         * Null for historical rows recorded before run lifecycle tracking
         */
        status: 'queued' | 'running' | 'complete' | null;
      }
    | {error: SeerWorkflowError; status: 'failed'}
  );

/**
 * The metric monitor breach that started a run
 */
type MonitorTrigger = {
  /**
   * The monitor may have since been deleted
   */
  detectorId: string;
  /**
   * Null when the monitor is deleted, moved out of the trigger's project, or the
   * viewer can't access it
   */
  detectorName: string | null;
  environment: string | null;
  eventId: string;
  /**
   * False once the triggering issue is deleted
   */
  groupExists: boolean;
  groupId: string;
  observedAt: string;
  occurrenceId: string;
  projectId: string;
  type: 'monitor';
  groupShortId?: string | null;
};

/**
 * A scheduled run
 */
type CronTrigger = {
  type: 'cron';
};

/**
 * What started a run. Discriminated by `type`; add new trigger variants to this union.
 */
type WorkflowTrigger = MonitorTrigger | CronTrigger;

type SeerAutomationRunBase = {
  configId: string;
  /**
   * The automation's user-supplied name. Null when unnamed
   */
  configName: string | null;
  dateAdded: string;
  dateCompleted: string | null;
  dateUpdated: string;
  executions: SeerWorkflowExecution[];
  id: string;
  strategy: string;
  trigger: WorkflowTrigger | null;
};

export type SeerAutomationRun = SeerAutomationRunBase &
  (
    | {
        /**
         * Null for historical rows recorded before run lifecycle tracking
         */
        status: 'queued' | 'running' | 'complete' | null;
      }
    | {
        // Null when failed executions carry the error details.
        error: SeerWorkflowError | null;
        status: 'failed' | 'rejected';
      }
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

export type SeerServiceAccountResponse = {
  allProjects: boolean;
  projectIds: number[];
  scopes: string[];
  serviceAccountId: string;
};

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
  monitorIds: number[];
  outputPolicy: Record<string, unknown>;
  /**
   * [-1] for all projects, [] for none, otherwise selected project IDs
   */
  projects: number[];
  schedule: string;
  seededDefault: string | null;
  serviceAccount: SeerServiceAccountResponse | null;
  strategy: string;
  version: number;
  /**
   * ID of the user who created the config. Omitted if unset
   */
  createdBy?: string;
  /**
   * When the latest visible run started. Omitted if there are none
   */
  dateLastRun?: string;
  /**
   * Status of the latest visible run. Omitted if there are none
   */
  lastRunStatus?: SeerAutomationRunStatus;
  name?: string;
  /**
   * ID of the user who last updated the config. Omitted if unset
   */
  updatedBy?: string;
};

/**
 * Service account settings sent when creating or updating a workflow config
 */
type SeerServiceAccountRequest = {
  allProjects: boolean;
  projectIds: number[];
  scopes: string[];
};

/**
 * Body of a POST to create a workflow config
 */
export type SeerWorkflowConfigCreateRequest = {
  serviceAccount: SeerServiceAccountRequest;
  strategy: WorkflowStrategy;
  enabled?: boolean;
  /**
   * Empty means all environments
   */
  environments?: string[];
  /**
   * Metric automations only; their projects come from the connected monitors
   */
  monitorIds?: number[];
  name?: string | null;
  /**
   * [-1] for all projects, otherwise selected project IDs. Omitted means none
   */
  projectIds?: number[];
  schedule?: string;
};

/**
 * Body of a PUT to a workflow config. Send at most one of projectIds or monitorIds
 */
export type SeerWorkflowConfigUpdateRequest = {
  enabled?: boolean;
  monitorIds?: number[];
  name?: string;
  /**
   * [-1] for all projects, otherwise selected project IDs
   */
  projectIds?: number[];
  serviceAccount?: SeerServiceAccountRequest;
};

export type SeerWorkflowConfigsResponse = {
  configs: SeerWorkflowConfigResponse[];
};
