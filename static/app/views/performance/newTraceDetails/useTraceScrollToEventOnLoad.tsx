import {useLayoutEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {TraceTree} from './traceModels/traceTree';
import type {TraceTreeNode} from './traceModels/traceTreeNode';
import type {TraceScheduler} from './traceRenderers/traceScheduler';
import type {useTraceScrollToPath} from './useTraceScrollToPath';

type UseTraceScrollToEventOnLoadProps = {
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
  const {trace, onTraceLoad, scheduler, scrollQueueRef, rerender} = options;

  useLayoutEffect(() => {
    if (initializedRef.current) {
      return;
    }
    if (trace.type !== 'trace') {
      return;
    }

    initializedRef.current = true;

    if (!scrollQueueRef.current) {
      onTraceLoad(trace, null, null);
      return;
    }

    const path = scrollQueueRef.current?.path;
    const eventId = scrollQueueRef.current?.eventId;

    if (!path && !eventId) {
      return;
    }

    function onTraceLoadComplete(node: TraceTreeNode<TraceTree.NodeValue> | null) {
      // Important to set scrollQueueRef.current to null and trigger a rerender
      // after the promise resolves as we show a loading state during scroll,
      // else the screen could jump around while we fetch span data
      scrollQueueRef.current = null;

      let index: number | null = node ? trace.list.indexOf(node) : -1;
      if (node && index === -1) {
        let parent_node = node.parent;
        while (parent_node) {
          // Transactions break autogrouping chains, so we can stop here
          trace.expand(parent_node, true);
          // This is very wasteful as it performs O(n^2) search each time we expand a node...
          // In most cases though, we should be operating on a tree with sub 10k elements and hopefully
          // a low autogrouped node count.
          index = node ? trace.list.findIndex(n => n === node) : -1;
          if (index !== -1) {
            break;
          }
          parent_node = parent_node.parent;
        }
      }

      if (index === -1 || !node) {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-view-scroll-to-node-error']);
          scope.captureMessage('Failed to scroll to node in trace tree');
        });

        onTraceLoad(trace, null, null);
        rerender();
        requestAnimationFrame(() => {
          scheduler.dispatch('initialize virtualized list');
        });
        return;
      }

      onTraceLoad(trace, node, index);
      rerender();
      // Allow react to rerender before dispatching the init event
      requestAnimationFrame(() => {
        scheduler.dispatch('initialize virtualized list');
      });
    }

    // Node path has higher specificity than eventId
    const promise = path
      ? TraceTree.ExpandToPath(trace, path, {
          api,
          organization,
        }).then(() => {
          return TraceTree.FindByPath(trace, path[0]);
        })
      : eventId
        ? TraceTree.ExpandToEventID(eventId, trace, {
            api,
            organization,
          })
        : Promise.resolve(null);

    promise.then(onTraceLoadComplete);
  }, [
    api,
    trace,
    onTraceLoad,
    scheduler,
    scrollQueueRef,
    rerender,
    initializedRef,
    organization,
  ]);
}
