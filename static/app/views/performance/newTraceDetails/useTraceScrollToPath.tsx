import {useEffect, useMemo, useRef} from 'react';
import * as qs from 'query-string';

import type {TraceTree} from './traceModels/traceTree';

function decodeScrollQueue(maybePath: unknown): TraceTree.NodePath[] | null {
  if (Array.isArray(maybePath)) {
    return maybePath;
  }

  if (typeof maybePath === 'string') {
    return [maybePath as TraceTree.NodePath];
  }

  return null;
}

type UseTraceScrollToPath =
  | {eventId?: string; path?: TraceTree.NodePath[]}
  | null
  | undefined;

export function getScrollToPath(): UseTraceScrollToPath {
  const queryParams = qs.parse(location.search);
  const scrollToNode = {
    eventId: (queryParams.eventId ?? queryParams.targetId) as string | undefined,
    path: decodeScrollQueue(queryParams.node) as TraceTree.NodePath[] | undefined,
  };

  if (scrollToNode && (scrollToNode.path || scrollToNode.eventId)) {
    return {
      eventId: scrollToNode.eventId!,
      path: scrollToNode.path,
    };
  }

  return null;
}

export function useTraceScrollToPath({
  traceSlug,
  scrollToEventId,
}: {
  traceSlug: string;
  /**
   * The node to open the waterfall on, for embedders that already know which one
   * the surrounding ui stands for and so have no reason to say it through the
   * page's query string. Takes precedence over the url.
   */
  scrollToEventId?: string;
}): React.MutableRefObject<UseTraceScrollToPath> {
  // Held stable so the queue's identity only changes when the target does: the
  // effects downstream of it re-run on identity.
  const explicitScrollTo = useMemo(
    () => (scrollToEventId ? {eventId: scrollToEventId} : null),
    [scrollToEventId]
  );

  const scrollQueueRef = useRef<
    {eventId?: string; path?: TraceTree.NodePath[]} | null | undefined
  >(explicitScrollTo ?? undefined);

  useEffect(() => {
    scrollQueueRef.current = explicitScrollTo ?? getScrollToPath();

    // Only re-run this effect when the traceSlug changes, not on every render since we manage
    // scroll internally in the traceWaterfall component, and only update the url for state consistency across
    // subsequent loads
  }, [traceSlug, explicitScrollTo]);

  return scrollQueueRef;
}
