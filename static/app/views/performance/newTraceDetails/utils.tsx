import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';

import {TraceType} from '../traceDetails/newTraceDetailsContent';
import {isRootTransaction} from '../traceDetails/utils';

export function getTraceType(
  traceSplitResult: TraceSplitResults<TraceFullDetailed>
): TraceType {
  const {transactions, orphan_errors} = traceSplitResult;

  const {roots, orphans} = (transactions ?? []).reduce(
    (counts, trace) => {
      if (isRootTransaction(trace)) {
        counts.roots++;
      } else {
        counts.orphans++;
      }
      return counts;
    },
    {roots: 0, orphans: 0}
  );

  if (roots === 0 && orphans > 0) {
    return TraceType.NO_ROOT;
  }

  if (roots === 1 && orphans > 0) {
    return TraceType.BROKEN_SUBTRACES;
  }

  if (roots > 1) {
    return TraceType.MULTIPLE_ROOTS;
  }

  if (orphan_errors && orphan_errors.length > 1) {
    return TraceType.ONLY_ERRORS;
  }

  if (roots === 1) {
    return TraceType.ONE_ROOT;
  }

  if (roots === 0 && orphans === 0) {
    return TraceType.EMPTY_TRACE;
  }

  throw new Error('Unknown trace type');
}
