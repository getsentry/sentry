import type {Location, LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

function getNodeId(node: BaseNode): string | undefined {
  if (isTransactionNode(node)) {
    return node.value.event_id;
  }
  if (isSpanNode(node)) {
    return node.value.span_id;
  }
  return undefined;
}

// In the current version, a segment is a parent transaction
function getEventId(node: BaseNode): string | undefined {
  if (isTransactionNode(node)) {
    return node.value.event_id;
  }
  return node.findParentTransaction()?.value?.event_id;
}

export function makeTransactionProfilingLink(
  profileId: string,
  options: {
    organization: Organization;
    projectSlug: string;
  },
  query: Location['query'] = {}
): LocationDescriptor | null {
  if (!options.projectSlug || !options.organization) {
    return null;
  }
  return generateProfileFlamechartRouteWithQuery({
    organization: options.organization,
    projectSlug: options.projectSlug,
    profileId,
    query,
  });
}

/**
 * Generates a link to a continuous profile for a given trace element type
 */
export function makeTraceContinuousProfilingLink(
  node: BaseNode,
  profilerId: string,
  options: {
    organization: Organization;
    projectSlug: string;
    threadId: string | undefined;
    traceId: string;
  },
  query: Location['query'] = {}
): LocationDescriptor | null {
  if (!options.projectSlug || !options.organization) {
    return null;
  }

  // We compute a time offset based on the duration of the span so that
  // users can see some context of things that occurred before and after the span.
  const transaction = isTransactionNode(node) ? node : node.findParentTransaction();
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
    organization: options.organization,
    projectSlug: options.projectSlug,
    profilerId,
    start: start.toISOString(),
    end: end.toISOString(),
    query: queryWithEventData,
  });
}
