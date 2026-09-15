import {useEffect, useRef} from 'react';
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

export type UseTraceScrollToPath =
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
  scrollToNode,
}: {
  traceSlug: string;
  /**
   * When set, the caller owns the scroll target and the URL is never read. Pass `null` for
   * "no target" — embedded waterfalls use this so the host page's `?node=`/`?eventId=` (which
   * may belong to an entirely different trace) cannot steer them. Must be referentially stable.
   */
  scrollToNode?: UseTraceScrollToPath;
}): React.MutableRefObject<UseTraceScrollToPath> {
  const scrollQueueRef = useRef<
    {eventId?: string; path?: TraceTree.NodePath[]} | null | undefined
  >(undefined);

  useEffect(() => {
    scrollQueueRef.current =
      scrollToNode === undefined ? getScrollToPath() : scrollToNode;

    // Only re-run this effect when the traceSlug changes, not on every render since we manage
    // scroll internally in the traceWaterfall component, and only update the url for state consistency across
    // subsequent loads
  }, [traceSlug, scrollToNode]);

  return scrollQueueRef;
}
