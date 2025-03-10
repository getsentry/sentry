import {isTraceSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function isEmptyTrace(trace: TraceTree.Trace): boolean {
  if (isTraceSplitResult(trace)) {
    return trace.transactions.length === 0 && trace.orphan_errors.length === 0;
  }

  return trace.length === 0;
}
