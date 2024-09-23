import {useLayoutEffect, useRef} from 'react';
import Sentry from '@sentry/react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  TraceTree,
  type TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {useTraceScrollToPath} from 'sentry/views/performance/newTraceDetails/useTraceScrollToPath';

type UseTraceScrollToEventOnLoadProps = {
  manager: VirtualizedViewManager;
  onTraceLoad: (
    trace: TraceTree,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    index: number | null
  ) => void;
  rerender: () => void;
  scheduler: TraceScheduler;
  scrollQueueRef: ReturnType<typeof useTraceScrollToPath>;
  trace: TraceTree;
};

export function useTraceScrollToEventOnLoad(options: UseTraceScrollToEventOnLoadProps) {
  const api = useApi();
  const organization = useOrganization();
  const initializedRef = useRef<boolean>(false);
  const {trace, manager, onTraceLoad, scheduler, scrollQueueRef, rerender} = options;

  useLayoutEffect(() => {
    if (initializedRef.current) {
      return;
    }
    if (trace.type !== 'trace' || !manager) {
      return;
    }

    initializedRef.current = true;

    if (!scrollQueueRef.current) {
      onTraceLoad(trace, null, null);
      return;
    }

    // Node path has higher specificity than eventId
    const promise = scrollQueueRef.current?.path
      ? TraceTree.ExpandToPath(trace, scrollQueueRef.current.path, rerender, {
          api,
          organization,
        })
      : scrollQueueRef.current.eventId
        ? TraceTree.ExpandToEventID(scrollQueueRef?.current?.eventId, trace, rerender, {
            api,
            organization,
          })
        : Promise.resolve(null);

    promise
      .then(maybeNode => {
        onTraceLoad(trace, maybeNode?.node ?? null, maybeNode?.index ?? null);

        if (!maybeNode) {
          Sentry.captureMessage('Failed to find and scroll to node in tree');
          return;
        }
      })
      .finally(() => {
        // Important to set scrollQueueRef.current to null and trigger a rerender
        // after the promise resolves as we show a loading state during scroll,
        // else the screen could jump around while we fetch span data
        scrollQueueRef.current = null;
        rerender();
        // Allow react to rerender before dispatching the init event
        requestAnimationFrame(() => {
          scheduler.dispatch('initialize virtualized list');
        });
      });
  }, [
    api,
    trace,
    manager,
    onTraceLoad,
    scheduler,
    scrollQueueRef,
    rerender,
    initializedRef,
    organization,
  ]);
}
