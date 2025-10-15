import {useCallback, useRef} from 'react';

import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import type {
  ViewManagerScrollAnchor,
  VirtualizedViewManager,
} from './traceRenderers/virtualizedViewManager';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import type {TraceReducerState} from './traceState';

export function useTraceWaterfallScroll({
  organization,
  tree,
  viewManager,
}: {
  organization: Organization;
  tree: TraceTree;
  viewManager: VirtualizedViewManager;
}): {
  onScrollToNode: (node: BaseNode) => Promise<BaseNode | null>;
  scrollRowIntoView: (
    node: BaseNode,
    index: number,
    anchor?: ViewManagerScrollAnchor,
    force?: boolean
  ) => void;
} {
  const api = useApi();
  const traceDispatch = useTraceStateDispatch();
  const previouslyScrolledToNodeRef = useRef<BaseNode | null>(null);
  const traceState = useTraceState();

  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  const traceStatePreferencesRef = useRef<
    Pick<TraceReducerState['preferences'], 'autogroup' | 'missing_instrumentation'>
  >(traceState.preferences);
  traceStatePreferencesRef.current = traceState.preferences;

  const scrollRowIntoView = useCallback(
    (
      node: BaseNode,
      index: number,
      anchor?: ViewManagerScrollAnchor,
      force?: boolean
    ) => {
      // Last node we scrolled to is the same as the node we want to scroll to
      if (previouslyScrolledToNodeRef.current === node && !force) {
        return;
      }

      // Always scroll to the row vertically
      viewManager.scrollToRow(index, anchor);
      if (viewManager.isOutsideOfView(node)) {
        viewManager.scrollRowIntoViewHorizontally(node, 0, 48, 'measured');
      }
      previouslyScrolledToNodeRef.current = node;
    },
    [viewManager]
  );

  const onScrollToNode = useCallback(
    (node: BaseNode): Promise<BaseNode | null> => {
      return TraceTree.ExpandToPath(tree, node.pathToNode(), {
        api,
        organization,
        preferences: traceStatePreferencesRef.current,
      }).then(() => {
        const maybeNode = tree.root.findChild(n => n === node);

        if (!maybeNode) {
          return null;
        }

        const index = TraceTree.EnforceVisibility(tree, maybeNode);
        if (index === -1) {
          return null;
        }

        scrollRowIntoView(maybeNode, index, 'center if outside', true);
        traceDispatch({
          type: 'set roving index',
          node: maybeNode,
          index,
          action_source: 'click',
        });

        if (traceStateRef.current.search.resultsLookup.has(maybeNode)) {
          traceDispatch({
            type: 'set search iterator index',
            resultIndex: index,
            resultIteratorIndex:
              traceStateRef.current.search.resultsLookup.get(maybeNode)!,
          });
        } else if (traceStateRef.current.search.resultIteratorIndex !== null) {
          traceDispatch({type: 'clear search iterator index'});
        }

        return maybeNode;
      });
    },
    [api, organization, scrollRowIntoView, tree, traceDispatch]
  );

  return {onScrollToNode, scrollRowIntoView};
}
