import type {Location, LocationDescriptor} from 'history';

import {generateContinuousProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const dateObj = new Date(value);

  if (isNaN(dateObj.getTime())) {
    return null;
  }

  return dateObj;
}

/**
 * Generates a link to a continuous profile for a given trace element type
 */
export function makeTraceContinuousProfilingLink(
  value: TraceTreeNode<TraceTree.NodeValue>,
  profilerId: string,
  options: {
    orgSlug: string;
    projectSlug: string;
  },
  query: Location['query'] = {}
): LocationDescriptor | null {
  if (!options.projectSlug || !options.orgSlug) {
    return null;
  }

  let start: Date | null = toDate(value.space[0]);
  let end: Date | null = toDate(value.space[0] + value.space[1]);

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

  return generateContinuousProfileFlamechartRouteWithQuery(
    options.orgSlug,
    options.projectSlug,
    profilerId,
    start.toISOString(),
    end.toISOString(),
    query
  );
}
