import {useEffect, useRef} from 'react';
import {createLoader, parseAsString} from 'nuqs';

import {parseAsRawList} from 'sentry/views/explore/queryParams/parsers';

import type {TraceTree} from './traceModels/traceTree';

const loadScrollToPathQueryParams = createLoader({
  eventId: parseAsString,
  node: parseAsRawList,
  targetId: parseAsString,
});

export type UseTraceScrollToPath =
  | {eventId?: string; path?: TraceTree.NodePath[]}
  | null
  | undefined;

export function getScrollToPath(): UseTraceScrollToPath {
  const {eventId, node, targetId} = loadScrollToPathQueryParams(location.search);
  const scrollToNode = {
    eventId: eventId ?? targetId ?? undefined,
    path: node.length > 0 ? (node as TraceTree.NodePath[]) : undefined,
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
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [traceSlug, scrollToNode]);

  return scrollQueueRef;
}
