import {isTraceSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  isEAPTraceNode,
  isEAPTransaction,
  isTraceNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {isRootEvent} from 'sentry/views/performance/traceDetails/utils';

export function isEmptyTrace(trace: TraceTree.Trace): boolean {
  if (isTraceSplitResult(trace)) {
    return trace.transactions.length === 0 && trace.orphan_errors.length === 0;
  }

  return trace.length === 0;
}

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation', 'ui.load'];

export type RepresentativeTraceEvent = {
  event: TraceTree.TraceEvent | OurLogsResponseItem | null;
  type: 'trace' | 'log';
};

export const getRepresentativeTraceEvent = (
  tree: TraceTree,
  logs: OurLogsResponseItem[] | undefined
): RepresentativeTraceEvent => {
  const hasLogs = logs && logs.length > 0;
  if (tree.type === 'empty' && hasLogs) {
    return {
      event: logs[0]!,
      type: 'log',
    };
  }

  const traceNode = tree.root.children[0];

  if (!traceNode) {
    return {
      event: null,
      type: 'trace',
    };
  }

  if (!isTraceNode(traceNode) && !isEAPTraceNode(traceNode)) {
    throw new TypeError('Not trace node');
  }

  let rootEvent: TraceTree.TraceEvent | null = null;
  let candidateEvent: TraceTree.TraceEvent | null = null;
  let firstEvent: TraceTree.TraceEvent | null = null;

  const isEAP = isEAPTraceNode(traceNode);
  const events = isEAP
    ? traceNode.value
    : [...traceNode.value.transactions, ...traceNode.value.orphan_errors];
  for (const event of events) {
    if (isRootEvent(event)) {
      rootEvent = event;

      if (!isEAP) {
        // For non-EAP traces, we return the first root event.
        break;
      }

      if (isEAPTransaction(event)) {
        // If we find a root EAP transaction, we can stop looking and use it for the title.
        break;
      }
      // Otherwise we keep looking for a root eap transaction. If we don't find one, we use other roots, like standalone spans.
      continue;
    } else if (
      // If we haven't found a root transaction, but we found a candidate transaction
      // with an op that we care about, we can use it for the title. We keep looking for
      // a root.
      !candidateEvent &&
      CANDIDATE_TRACE_TITLE_OPS.includes(
        'transaction.op' in event
          ? event['transaction.op']
          : 'op' in event
            ? event.op
            : ''
      )
    ) {
      candidateEvent = event;
      continue;
    } else if (!firstEvent) {
      // If we haven't found a root or candidate transaction, we can use the first transaction
      // in the trace for the title.
      firstEvent = event;
    }
  }

  return {
    event: rootEvent ?? candidateEvent ?? firstEvent,
    type: 'trace',
  };
};

export const isTraceItemDetailsResponse = (
  data: TraceRootEventQueryResults['data']
): data is TraceItemDetailsResponse => {
  return data !== undefined && 'attributes' in data;
};
