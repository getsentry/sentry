import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  isEAPTraceNode,
  isRootEvent,
  isTraceNode,
  isTraceSplitResult,
  isUptimeCheckNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function isEmptyTrace(trace: TraceTree.Trace): boolean {
  if (isTraceSplitResult(trace)) {
    return trace.transactions.length === 0 && trace.orphan_errors.length === 0;
  }

  return trace.length === 0;
}

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation', 'ui.load'];

export type RepresentativeTraceEvent = {
  event: TraceTree.TraceEvent | OurLogsResponseItem | null;
  type: 'span' | 'log' | 'uptime_check';
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
      type: 'span',
    };
  }

  if (!isTraceNode(traceNode) && !isEAPTraceNode(traceNode)) {
    throw new TypeError('Not trace node');
  }

  const traceChild = traceNode.children[0];

  if (traceChild && isUptimeCheckNode(traceChild)) {
    return {type: 'uptime_check', event: traceChild.value};
  }

  let preferredRootEvent: TraceTree.TraceEvent | null = null;
  let firstRootEvent: TraceTree.TraceEvent | null = null;
  let candidateEvent: TraceTree.TraceEvent | null = null;
  let firstEvent: TraceTree.TraceEvent | null = null;

  const isEAP = isEAPTraceNode(traceNode);
  const events = isEAP
    ? traceNode.value
    : [...traceNode.value.transactions, ...traceNode.value.orphan_errors];
  for (const event of events) {
    if (isRootEvent(event)) {
      if (!firstRootEvent) {
        firstRootEvent = event;
      }

      if (hasPreferredOp(event)) {
        preferredRootEvent = event;
        break;
      }
      // Otherwise we keep looking for a root eap transaction. If we don't find one, we use other roots, like standalone spans.
      continue;
    } else if (
      // If we haven't found a root transaction, but we found a candidate transaction
      // with an op that we care about, we can use it for the title. We keep looking for
      // a root.
      !candidateEvent &&
      hasPreferredOp(event)
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
    event: preferredRootEvent ?? firstRootEvent ?? candidateEvent ?? firstEvent,
    type: 'span',
  };
};

export const isTraceItemDetailsResponse = (
  data: TraceRootEventQueryResults['data']
): data is TraceItemDetailsResponse => {
  return data !== undefined && 'attributes' in data;
};

export const isValidEventUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}[0-9a-f]{4}[1-5][0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Prefer "special" root events over generic root events when generating a title
 * for the waterfall view. Picking these improves contextual navigation for linked
 * traces, resulting in more meaningful waterfall titles.
 */
function hasPreferredOp(event: TraceTree.TraceEvent): boolean {
  const op =
    'op' in event
      ? event.op
      : 'transaction.op' in event
        ? event['transaction.op']
        : undefined;
  return !!op && CANDIDATE_TRACE_TITLE_OPS.includes(op);
}
