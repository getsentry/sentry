import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

// Shim for the run_id -> sentry_run_id migration. The autofix endpoint still
// accepts the deprecated integer `run_id` but prefers the UUID `sentry_run_id`
// when present. Delete this file once the integer path is retired server-side.

export function getAutofixRunId(
  runState: {run_id: number; sentry_run_id?: string | null} | null | undefined
): SeerExplorerRunId | undefined {
  return runState?.sentry_run_id ?? runState?.run_id;
}

export function continueRunData(
  runId: SeerExplorerRunId
): Record<string, string | number> {
  return typeof runId === 'string' ? {sentry_run_id: runId} : {run_id: runId};
}
