import {useRef} from 'react';
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

export function useTraceScrollToPath(
  path: UseTraceScrollToPath
): React.MutableRefObject<UseTraceScrollToPath> {
  const scrollQueueRef = useRef<
    {eventId?: string; path?: TraceTree.NodePath[]} | null | undefined
  >(undefined);

  // If we havent decoded anything yet, then decode the path
  if (scrollQueueRef.current === undefined) {
    let scrollToNode: UseTraceScrollToPath = path;

    if (!path) {
      const queryParams = qs.parse(location.search);

      scrollToNode = {
        eventId: (queryParams.eventId ?? queryParams.targetId) as string | undefined,
        path: decodeScrollQueue(queryParams.node) as TraceTree.NodePath[] | undefined,
      };
    }

    if (scrollToNode && (scrollToNode.path || scrollToNode.eventId)) {
      scrollQueueRef.current = {
        eventId: scrollToNode.eventId as string,
        path: scrollToNode.path,
      };
    } else {
      scrollQueueRef.current = null;
    }
  }

  return scrollQueueRef;
}
