import {useEffect, useMemo, useRef} from 'react';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';

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

export function getScrollToPath(queryString: string): UseTraceScrollToPath {
  const queryParams = qs.parse(queryString);
  const scrollToNode = {
    eventId: (queryParams.eventId ?? queryParams.targetId) as string | undefined,
    path: decodeScrollQueue(queryParams.node) as TraceTree.NodePath[] | undefined,
  };

  if (scrollToNode && (scrollToNode.path || scrollToNode.eventId)) {
    return {
      eventId: scrollToNode.eventId as string,
      path: scrollToNode.path,
    };
  }

  return null;
}

export function useTraceScrollToPath({
  traceSlug,
}: {
  traceSlug: string;
}): React.MutableRefObject<UseTraceScrollToPath> {
  const scrollQueueRef = useRef<
    {eventId?: string; path?: TraceTree.NodePath[]} | null | undefined
  >(undefined);

  const location = useLocation();
  const scrollPath = useMemo(() => {
    return getScrollToPath(location.search);
  }, [location.search]);

  useEffect(() => {
    scrollQueueRef.current = scrollPath;

    // Only re-run this effect when the path or traceSlug changes, not on every render since we manage
    // scroll internally in the traceWaterfall component, and only update the url for state consistency across
    // subsequent loads
  }, [traceSlug, scrollPath]);

  return scrollQueueRef;
}
