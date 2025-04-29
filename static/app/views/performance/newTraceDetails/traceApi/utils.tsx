import {isTraceSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  isEAPTraceNode,
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

  let firstRootEvent: TraceTree.TraceEvent | null = null;
  let candidateEvent: TraceTree.TraceEvent | null = null;
  let firstEvent: TraceTree.TraceEvent | null = null;

  const events = isTraceNode(traceNode)
    ? [...traceNode.value.transactions, ...traceNode.value.orphan_errors]
    : traceNode.value;
  for (const event of events) {
    // If we find a root transaction, we can stop looking and use it for the title.
    if (!firstRootEvent && isRootEvent(event)) {
      firstRootEvent = event;
      break;
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
    event: firstRootEvent ?? candidateEvent ?? firstEvent,
    type: 'trace',
  };
};

export const isTraceItemDetailsResponse = (
  data: TraceRootEventQueryResults['data']
): data is TraceItemDetailsResponse => {
  return data !== undefined && 'attributes' in data;
};
