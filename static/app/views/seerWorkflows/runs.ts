import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {SeerWorkflowRun, WorkflowRow} from 'sentry/views/seerWorkflows/types';

export function toWorkflowRow(run: SeerWorkflowRun): WorkflowRow {
  const status = run.extras.status;
  return {
    id: `${run.id}:${run.strategy}`,
    runId: run.id,
    dateAdded: run.dateAdded,
    strategy: run.strategy,
    status: status && status !== 'complete' ? status : 'succeeded',
    runStatus: status,
    source: 'manual',
    errorMessage: run.errorMessage,
    results: run.results ?? [],
    seerRunId: run.seerRunId,
    ...STRATEGY_META[run.strategy].getRowDetails?.(run),
  };
}
