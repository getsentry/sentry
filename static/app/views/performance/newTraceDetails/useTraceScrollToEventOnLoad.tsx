import {useLayoutEffect, useRef} from 'react';
import Sentry from '@sentry/react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  isAutogroupedNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
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
      .then(async node => {
        if (!scrollQueueRef.current?.path && !scrollQueueRef.current?.eventId) {
          return;
        }

        if (!node) {
          Sentry.captureMessage('Failed to find and scroll to node in tree');
          return;
        }

        // When users are coming off an eventID link, we want to fetch the children
        // of the node that the eventID points to. This is because the eventID link
        // only points to the transaction, but we want to fetch the children of the
        // transaction to show the user the list of spans in that transaction
        if (scrollQueueRef.current.eventId && node?.canFetch) {
          await trace.zoomIn(node, true, {api, organization}).catch(_e => {
            Sentry.captureMessage('Failed to fetch children of eventId on mount');
          });
        }

        let index = trace.list.indexOf(node);
        // We have found the node, yet it is somehow not in the visible tree.
        // This means that the path we were given did not match the current tree.
        // This sometimes happens when we receive external links like span-x, txn-y
        // however the resulting tree looks like span-x, autogroup, txn-y. In this case,
        // we should expand the autogroup node and try to find the node again.
        if (node && index === -1) {
          let parent_node = node.parent;
          while (parent_node) {
            // Transactions break autogrouping chains, so we can stop here
            if (isTransactionNode(parent_node)) {
              break;
            }
            if (isAutogroupedNode(parent_node)) {
              trace.expand(parent_node, true);
              // This is very wasteful as it performs O(n^2) search each time we expand a node...
              // In most cases though, we should be operating on a tree with sub 10k elements and hopefully
              // a low autogrouped node count.
              index = node ? trace.list.findIndex(n => n === node) : -1;
              if (index !== -1) {
                break;
              }
            }
            parent_node = parent_node.parent;
          }
        }
        onTraceLoad(trace, node, index === -1 ? null : index);
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
