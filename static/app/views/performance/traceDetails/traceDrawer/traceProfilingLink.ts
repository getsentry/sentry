import type {LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
  PROFILE_CONTEXT_WINDOW_MS,
} from 'sentry/utils/profiling/routes';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';
import {getRecordedSpace} from 'sentry/views/performance/traceDetails/traceModels/clockDriftCorrection';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

export function makeTransactionProfilingLink(
  profileId: string,
  options: {organization: Organization; projectSlug: string}
): LocationDescriptor | null {
  if (!options.projectSlug || !options.organization) {
    return null;
  }
  return generateProfileFlamechartRouteWithQuery({
    organization: options.organization,
    projectSlug: options.projectSlug,
    profileId,
  });
}

export function makeTraceContinuousProfilingLink(
  node: BaseNode,
  profilerId: string,
  options: {
    organization: Organization;
    projectSlug: string;
    threadId: string | undefined;
    traceId: string;
  }
): LocationDescriptor | null {
  if (!options.projectSlug || !options.organization || !profilerId) {
    return null;
  }

  const [recordedStart, recordedDuration] = getRecordedSpace(node);
  const start = getDateFromTimestamp(recordedStart - PROFILE_CONTEXT_WINDOW_MS);
  const end = getDateFromTimestamp(
    recordedStart + recordedDuration + PROFILE_CONTEXT_WINDOW_MS
  );

  if (start === null || end === null) {
    return null;
  }

  const query: Record<string, string> = {spanId: node.id, traceId: options.traceId};
  const transactionSpanId = isEAPSpanNode(node) ? node.transactionSpanId : undefined;

  if (transactionSpanId) {
    query.transactionId = transactionSpanId;
  } else if (node.transactionId) {
    query.eventId = node.transactionId;
  }

  if (typeof options.threadId === 'string') {
    query.tid = options.threadId;
  }

  return generateContinuousProfileFlamechartRouteWithQuery({
    organization: options.organization,
    projectSlug: options.projectSlug,
    profilerId,
    start: start.toISOString(),
    end: end.toISOString(),
    query,
  });
}
