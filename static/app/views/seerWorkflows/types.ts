import {z} from 'zod';

import type {PullRequest, PullRequestStatus} from 'sentry/types/integrations';

export type WorkflowRunSource = 'cron' | 'manual';

export type WorkflowRunStatus = 'running' | 'complete' | 'partial' | 'failed';

type SeerWorkflowRunBase = {
  dateAdded: string;
  dateCompleted: string | null;
  errorMessage: string | null;
  id: string;
  results: SeerWorkflowResult[];
  source: WorkflowRunSource | null;
  seerRunId?: string;
};

// TODO(aliu): Add run types for the other backend strategies (e.g. agentic_triage_v2), so
// WorkflowStrategy covers every strategy the API can return.
export type SeerWorkflowRun =
  | SeerAgenticTriageRun
  | SeerBreachedMetricsRun
  | SeerMonitorCleanupRun;

export type WorkflowStrategy = SeerWorkflowRun['strategy'];

type SeerBreachedMetricsRun = SeerWorkflowRunBase & {
  extras: {status: WorkflowRunStatus};
  strategy: 'breached_metrics';
};

export type SeerMonitorCleanupRun = SeerWorkflowRunBase & {
  extras: {status: WorkflowRunStatus};
  strategy: 'duplicate_monitors';
};

export type SeerAgenticTriageRunPullRequest = PullRequest & {
  status: PullRequestStatus | null;
};

export type SeerAgenticTriageRunIssue = {
  action: string;
  dateAdded: string;
  groupId: string;
  groupShortId: string | null;
  groupTitle: string | null;
  id: string;
  reason: string | null;
  seerRunId: string | null;
  skipReason: string | null;
  pullRequests?: SeerAgenticTriageRunPullRequest[];
};

// A Seer run dispatched by an agentic triage run, openable in Explorer.
type SeerAgenticTriageSeerRun = {
  seerRunId: string | null;
};

type SeerAgenticTriageRunOptions = {
  dry_run?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
};

export type SeerAgenticTriageRunErrorType =
  | 'no_quota'
  | 'eligible_projects_failed'
  | 'no_seer_access'
  | 'invalid_shard_plan'
  | 'shard_dispatch_failed'
  | 'shard_delivery_failed'
  | 'unknown';

export type SeerAgenticTriageRun = SeerWorkflowRunBase & {
  errorType: SeerAgenticTriageRunErrorType | null;
  extras: {options?: SeerAgenticTriageRunOptions; status?: WorkflowRunStatus};
  issues: SeerAgenticTriageRunIssue[];
  seerRuns: SeerAgenticTriageSeerRun[];
  strategy: 'agentic_triage' | 'agentic_triage_v2'; // TODO: branch to new type when needed
};

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

export type WorkflowRunCreateRequest = {
  strategy: WorkflowStrategy;
};

export type SeerWorkflowResult = {
  extras: unknown;
  id: string;
  kind: string;
  seerRunId: string | null;
};

export type WorkflowDisplayStatus =
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'running'
  | 'partial';

const monitorCleanupResourceSchema = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string(),
});

// Validate the fields this UI reads, allowing compatible additions to the output.
export const monitorCleanupOutputSchema = z.object({
  projectId: z.string(),
  projectSlug: z.string(),
  scan: z.object({
    status: z.string(),
    monitorsScanned: z.number().int().nonnegative(),
  }),
  findings: z.array(
    z.object({
      kind: z.string(),
      monitors: z.array(monitorCleanupResourceSchema),
      reason: z.string().nullish(),
      suggestedKeepId: z.string().nullish(),
      alerts: z.array(monitorCleanupResourceSchema).nullish(),
      comparison: z
        .array(
          z.object({
            property: z.string(),
            values: z.array(z.object({monitorId: z.string(), value: z.string()})),
          })
        )
        .nullish(),
    })
  ),
});

export type MonitorCleanupFinding = z.infer<
  typeof monitorCleanupOutputSchema
>['findings'][number];

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
   * When the latest visible run started, in Unix seconds. Omitted if there are none
   */
  lastRun?: number;
};

export type SeerWorkflowConfigsResponse = {
  configs: SeerWorkflowConfigResponse[];
};
