import type {LocationDescriptor} from 'history';

import type {Organization} from 'sentry/types/organization';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
  PROFILE_CONTEXT_WINDOW_MS,
} from 'sentry/utils/profiling/routes';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

export function makeTransactionProfilingLink(
  profileId: string,
  options: {
    organization: Organization;
    projectSlug: string;
  }
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

  const start = getDateFromTimestamp(node.space[0] - PROFILE_CONTEXT_WINDOW_MS);
  const end = getDateFromTimestamp(
    node.space[0] + node.space[1] + PROFILE_CONTEXT_WINDOW_MS
  );

  if (start === null || end === null) {
    return null;
  }

  const query: Record<string, string> = {
    spanId: node.id,
    traceId: options.traceId,
  };
  const transactionId = node.transactionId;

  if (transactionId) {
    query[node.isEAPEvent ? 'transactionId' : 'eventId'] = transactionId;
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
