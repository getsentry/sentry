import type {Location, LocationDescriptor} from 'history';

import {getDateFromTimestamp} from 'sentry/utils/dates';
import {generateContinuousProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function getNodeId(node: TraceTreeNode<TraceTree.NodeValue>): string | undefined {
  if (isTransactionNode(node)) {
    return node.value.event_id;
  }
  if (isSpanNode(node)) {
    return node.value.span_id;
  }
  return undefined;
}

// In the current version, a segment is a parent transaction
function getEventId(node: TraceTreeNode<TraceTree.NodeValue>): string | undefined {
  if (isTransactionNode(node)) {
    return node.value.event_id;
  }
  return node.parent_transaction?.value?.event_id;
}

/**
 * Generates a link to a continuous profile for a given trace element type
 */
export function makeTraceContinuousProfilingLink(
  node: TraceTreeNode<TraceTree.NodeValue>,
  profilerId: string,
  options: {
    orgSlug: string;
    projectSlug: string;
    threadId: string | undefined;
    traceId: string;
  },
  query: Location['query'] = {}
): LocationDescriptor | null {
  if (!options.projectSlug || !options.orgSlug) {
    return null;
  }

  // We compute a time offset based on the duration of the span so that
  // users can see some context of things that occurred before and after the span.
  const transaction = isTransactionNode(node) ? node : node.parent_transaction;
  if (!transaction) {
    return null;
  }
  let start: Date | null = getDateFromTimestamp(transaction.space[0]);
  let end: Date | null = getDateFromTimestamp(
    transaction.space[0] + transaction.space[1]
  );

  // End timestamp is required to generate a link
  if (end === null || typeof profilerId !== 'string' || profilerId === '') {
    return null;
  }

  // If we have an end, but no start, then we'll generate a window of time around end timestamp
  // so that we can show context around the event.
  if (end && end.getTime() === start?.getTime()) {
    const PRE_CONTEXT_WINDOW_MS = 100;
    const POST_CONTEXT_WINDOW_MS = 100;
    start = new Date(start.getTime() - PRE_CONTEXT_WINDOW_MS);
    end = new Date(end.getTime() + POST_CONTEXT_WINDOW_MS);
  }

  // We require a full time range to open a flamechart
  if (start === null) {
    return null;
  }

  // TransactionId is required to generate a link because
  // we need to link to the segment of the trace and fetch its spans
  const eventId = getEventId(node);
  if (!eventId) {
    return null;
  }

  const queryWithEventData: Record<string, string> = {
    ...query,
    eventId,
    traceId: options.traceId,
  };

  if (typeof options.threadId === 'string') {
    queryWithEventData.tid = options.threadId;
  }

  const spanId = getNodeId(node);
  if (spanId) {
    queryWithEventData.spanId = spanId;
  }

  return generateContinuousProfileFlamechartRouteWithQuery({
    orgSlug: options.orgSlug,
    projectSlug: options.projectSlug,
    profilerId: profilerId,
    start: start.toISOString(),
    end: end.toISOString(),
    query: queryWithEventData,
  });
}
