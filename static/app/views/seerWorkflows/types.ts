import {z} from 'zod';

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
  status: WorkflowRowStatus;
  strategy: WorkflowStrategy;
  errorMessage?: string | null;
  resultText?: string;
  runStatus?: WorkflowRunStatus;
  seerRunId?: string;
  source?: string;
  triage?: NightShiftRow;
};

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
