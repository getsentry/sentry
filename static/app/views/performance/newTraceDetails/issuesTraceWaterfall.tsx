import type React from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useDividerResizeSync} from 'sentry/views/performance/newTraceDetails/useDividerResizeSync';
import {useTraceSpaceListeners} from 'sentry/views/performance/newTraceDetails/useTraceSpaceListeners';

import type {TraceTreeNode} from './traceModels/traceTreeNode';
import {TraceScheduler} from './traceRenderers/traceScheduler';
import {TraceView as TraceViewModel} from './traceRenderers/traceView';
import {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import {Trace} from './trace';
import {traceAnalytics} from './traceAnalytics';
import {
  isAutogroupedNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from './traceGuards';
import type {TraceReducerState} from './traceState';
import {
  traceNodeAdjacentAnalyticsProperties,
  traceNodeAnalyticsName,
} from './traceTreeAnalytics';
import TraceTypeWarnings from './traceTypeWarnings';
import type {TraceWaterfallProps} from './traceWaterfall';
import {TraceWaterfallState} from './traceWaterfallState';
import {useTraceOnLoad} from './useTraceOnLoad';
import {useTraceScrollToPath} from './useTraceScrollToPath';
import {useTraceTimelineChangeSync} from './useTraceTimelineChangeSync';

const noopTraceSearch = () => {};

interface IssuesTraceWaterfallProps extends TraceWaterfallProps {
  /**
   * Ignore eventId or path query parameters and use the provided node.
   * Must be set at component mount, no reactivity
   */
  scrollToNode: {eventId?: string; path?: TraceTree.NodePath[]};
}

export function IssuesTraceWaterfall(props: IssuesTraceWaterfallProps) {
  const {projects} = useProjects();
  const organization = useOrganization();

  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();

  const [forceRender, rerender] = useReducer(x => (x + 1) % Number.MAX_SAFE_INTEGER, 0);

  const traceView = useMemo(() => new TraceViewModel(), []);
  const traceScheduler = useMemo(() => new TraceScheduler(), []);

  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;

  const scrollQueueRef = useTraceScrollToPath(props.scrollToNode);

  useEffect(() => {
    trackAnalytics('performance_views.trace_view_v1_page_load', {
      organization: props.organization,
      source: props.source,
    });
  }, [props.organization, props.source]);

  const previouslyFocusedNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );
  const previouslyScrolledToNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );

  // Assign the trace state to a ref so we can access it without re-rendering
  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  const traceStatePreferencesRef = useRef<
    Pick<TraceReducerState['preferences'], 'autogroup' | 'missing_instrumentation'>
  >(traceState.preferences);
  traceStatePreferencesRef.current = traceState.preferences;

  // Initialize the view manager right after the state reducer
  const viewManager = useMemo(() => {
    return new VirtualizedViewManager(
      {
        list: {width: traceState.preferences.list.width},
        span_list: {width: 1 - traceState.preferences.list.width},
      },
      traceScheduler,
      traceView
    );
    // We only care about initial state when we initialize the view manager
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize the tabs reducer when the tree initializes
  useLayoutEffect(() => {
    return traceDispatch({
      type: 'set roving count',
      items: props.tree.list.length - 1,
    });
  }, [props.tree.list.length, traceDispatch]);

  // We need to heavily debounce query string updates because the rest of the app is so slow
  // to rerender that it causes the search to drop frames on every keystroke...
  const QUERY_STRING_STATE_DEBOUNCE = 300;
  const queryStringAnimationTimeoutRef = useRef<{id: number} | null>(null);

  const setRowAsFocused = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue> | null,
      _event: React.MouseEvent<HTMLElement> | null,
      _resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>,
      index: number | null,
      debounce: number = QUERY_STRING_STATE_DEBOUNCE
    ) => {
      // sync query string with the clicked node
      if (node) {
        if (queryStringAnimationTimeoutRef.current) {
          cancelAnimationTimeout(queryStringAnimationTimeoutRef.current);
        }
        queryStringAnimationTimeoutRef.current = requestAnimationTimeout(() => {
          const currentQueryStringPath = qs.parse(location.search).node;
          const nextNodePath = TraceTree.PathToNode(node);
          // Updating the query string with the same path is problematic because it causes
          // the entire sentry app to rerender, which is enough to cause jank and drop frames
          if (JSON.stringify(currentQueryStringPath) === JSON.stringify(nextNodePath)) {
            return;
          }
          const {eventId: _eventId, ...query} = qs.parse(location.search);
          browserHistory.replace({
            pathname: location.pathname,
            query: {
              ...query,
              node: nextNodePath,
            },
          });
          queryStringAnimationTimeoutRef.current = null;
        }, debounce);

        if (typeof index === 'number') {
          traceDispatch({
            type: 'set roving index',
            node,
            index,
            action_source: 'click',
          });
        }
      }
    },
    [traceDispatch]
  );

  const onRowClick = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue>,
      _event: React.MouseEvent<HTMLElement>,
      index: number
    ) => {
      trackAnalytics('trace.trace_layout.span_row_click', {
        organization,
        num_children: node.children.length,
        type: traceNodeAnalyticsName(node),
        project_platform:
          projects.find(p => p.slug === node.metadata.project_slug)?.platform || 'other',
        ...traceNodeAdjacentAnalyticsProperties(node),
      });

      traceDispatch({
        type: 'set roving index',
        node,
        index,
        action_source: 'click',
      });
    },
    [organization, projects, traceDispatch]
  );

  // Callback that is invoked when the trace loads and reaches its initialied state,
  // that is when the trace tree data and any data that the trace depends on is loaded,
  // but the trace is not yet rendered in the view.
  const onTraceLoad = useCallback(() => {
    traceAnalytics.trackTraceShape(props.tree, projectsRef.current, props.organization);
    // The tree has the data fetched, but does not yet respect the user preferences.
    // We will autogroup and inject missing instrumentation if the preferences are set.
    // and then we will perform a search to find the node the user is interested in.

    const query = qs.parse(location.search);
    if (query.fov && typeof query.fov === 'string') {
      viewManager.maybeInitializeTraceViewFromQS(query.fov);
    }
    if (traceStateRef.current.preferences.missing_instrumentation) {
      TraceTree.DetectMissingInstrumentation(props.tree.root);
    }
    if (traceStateRef.current.preferences.autogroup.sibling) {
      TraceTree.AutogroupSiblingSpanNodes(props.tree.root);
    }
    if (traceStateRef.current.preferences.autogroup.parent) {
      TraceTree.AutogroupDirectChildrenSpanNodes(props.tree.root);
    }

    // Construct the visual representation of the tree
    props.tree.build();

    const eventId = scrollQueueRef.current?.eventId;
    const [type, path] = scrollQueueRef.current?.path?.[0]?.split('-') ?? [];
    scrollQueueRef.current = null;

    let node =
      (path === 'root' && props.tree.root.children[0]) ||
      (path && TraceTree.FindByID(props.tree.root, path)) ||
      (eventId && TraceTree.FindByID(props.tree.root, eventId)) ||
      null;

    // If the node points to a span, but we found an autogrouped node, then
    // perform another search inside the autogrouped node to find the more detailed
    // location of the span. This is necessary because the id of the autogrouped node
    // is in some cases inferred from the spans it contains and searching by the span id
    // just gives us the first match which may not be the one the user is looking for.
    if (node) {
      if (isAutogroupedNode(node) && type !== 'ag') {
        if (isParentAutogroupedNode(node)) {
          node = TraceTree.FindByID(node.head, eventId ?? path) ?? node;
        } else if (isSiblingAutogroupedNode(node)) {
          node = node.children.find(n => TraceTree.FindByID(n, eventId ?? path)) ?? node;
        }
      }
    }

    const index = node ? TraceTree.EnforceVisibility(props.tree, node) : -1;

    if (index === -1 || !node) {
      const hasScrollComponent = !!(path || eventId);
      if (hasScrollComponent) {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-view-scroll-to-node-error']);
          scope.captureMessage('Failed to scroll to node in trace tree');
        });
      }

      return;
    }

    // At load time, we want to scroll the row into view, but we need to wait for the view
    // to initialize before we can do that. We listen for the 'initialize virtualized list' and scroll
    // to the row in the view if it is not in view yet. If its in the view, then scroll to it immediately.
    traceScheduler.once('initialize virtualized list', () => {
      function onTargetRowMeasure() {
        if (!node || !viewManager.row_measurer.cache.has(node)) {
          return;
        }
        viewManager.row_measurer.off('row measure end', onTargetRowMeasure);
        if (viewManager.isOutsideOfView(node)) {
          viewManager.scrollRowIntoViewHorizontally(node!, 0, 48, 'measured');
        }
      }
      viewManager.scrollToRow(index, 'center');
      viewManager.row_measurer.on('row measure end', onTargetRowMeasure);
      previouslyScrolledToNodeRef.current = node;

      setRowAsFocused(node, null, traceStateRef.current.search.resultsLookup, index);
      traceDispatch({
        type: 'set roving index',
        node: node,
        index: index,
        action_source: 'load',
      });
    });
  }, [
    setRowAsFocused,
    traceDispatch,
    viewManager,
    traceScheduler,
    scrollQueueRef,
    props.tree,
    props.organization,
  ]);

  useDividerResizeSync(traceScheduler);
  useTraceTimelineChangeSync({
    tree: props.tree,
    traceScheduler,
  });

  useTraceSpaceListeners({
    view: traceView,
    viewManager,
    traceScheduler,
  });

  const onLoadScrollStatus = useTraceOnLoad({
    onTraceLoad,
    pathToNodeOrEventId: scrollQueueRef.current,
    tree: props.tree,
  });

  return (
    <Fragment>
      <TraceTypeWarnings
        tree={props.tree}
        traceSlug={props.traceSlug}
        organization={organization}
      />
      <TraceGrid layout={traceState.preferences.layout}>
        <Trace
          trace={props.tree}
          rerender={rerender}
          trace_id={props.traceSlug}
          onRowClick={onRowClick}
          onTraceSearch={noopTraceSearch}
          previouslyFocusedNodeRef={previouslyFocusedNodeRef}
          manager={viewManager}
          scheduler={traceScheduler}
          forceRerender={forceRender}
          isLoading={props.tree.type === 'loading' || onLoadScrollStatus === 'pending'}
        />

        {props.tree.type === 'loading' || onLoadScrollStatus === 'pending' ? (
          <TraceWaterfallState.Loading />
        ) : props.tree.type === 'error' ? (
          <TraceWaterfallState.Error />
        ) : props.tree.type === 'empty' ? (
          <TraceWaterfallState.Empty />
        ) : null}
      </TraceGrid>
    </Fragment>
  );
}

const TraceGrid = styled('div')<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  border: 1px solid ${p => p.theme.border};
  flex: 1 1 100%;
  display: grid;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  position: relative;
`;
