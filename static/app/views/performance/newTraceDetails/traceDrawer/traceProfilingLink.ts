import type {Location, LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

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
  const transactionId = node.transactionId;

  // If the node is the transaction, we can use it directly. Otherwise, we need to find the parent transaction.
  const transaction =
    node.id === transactionId ? node : node.findParent(n => n.id === transactionId);

  // TransactionId is required to generate a link because
  // we need to link to the segment of the trace and fetch its spans
  if (!transaction || !transactionId) {
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

  const queryWithEventData: Record<string, string> = {
    ...query,
    eventId: transactionId,
    traceId: options.traceId,
  };

  if (typeof options.threadId === 'string') {
    queryWithEventData.tid = options.threadId;
  }

  const nodeId = node.id;
  if (nodeId) {
    queryWithEventData.spanId = nodeId;
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
