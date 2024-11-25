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

import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useDividerResizeSync} from 'sentry/views/performance/newTraceDetails/useDividerResizeSync';
import {useTraceSpaceListeners} from 'sentry/views/performance/newTraceDetails/useTraceSpaceListeners';

import type {TraceTreeNode} from './traceModels/traceTreeNode';
import {TraceScheduler} from './traceRenderers/traceScheduler';
import {TraceView as TraceViewModel} from './traceRenderers/traceView';
import {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import {Trace} from './trace';
import {traceAnalytics} from './traceAnalytics';
import type {TraceReducerState} from './traceState';
import {
  traceNodeAdjacentAnalyticsProperties,
  traceNodeAnalyticsName,
} from './traceTreeAnalytics';
import TraceTypeWarnings from './traceTypeWarnings';
import type {TraceWaterfallProps} from './traceWaterfall';
import {TraceGrid} from './traceWaterfall';
import {TraceWaterfallState} from './traceWaterfallState';
import {useTraceIssuesOnLoad} from './useTraceOnLoad';
import {useTraceTimelineChangeSync} from './useTraceTimelineChangeSync';

const noopTraceSearch = () => {};

interface IssuesTraceWaterfallProps extends TraceWaterfallProps {
  event: Event;
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

  useEffect(() => {
    trackAnalytics('performance_views.trace_view_v1_page_load', {
      organization: props.organization,
      source: props.source,
    });
  }, [props.organization, props.source]);

  const previouslyFocusedNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
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
    // Construct the visual representation of the tree
    IssuesTraceTree.CollapseNodes(props.tree.root);
    props.tree.build();

    // @TODO: if there is a node, find its index in the list
    const index = -1;
    const node = null;
    if (!node || index === -1) {
      return;
    }

    // We dont want to focus the row at load time, because it will cause the page to scroll down to
    // the trace section. Mark is as scrolled on load so nothing will happen.
    previouslyFocusedNodeRef.current = node;
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

      // setRowAsFocused(node, null, traceStateRef.current.search.resultsLookup, index);
      traceDispatch({
        type: 'set roving index',
        node,
        index,
        action_source: 'load',
      });
    });
  }, [traceDispatch, viewManager, traceScheduler, props.tree, props.organization]);

  useTraceTimelineChangeSync({
    tree: props.tree,
    traceScheduler,
  });

  useTraceSpaceListeners({
    view: traceView,
    viewManager,
    traceScheduler,
  });

  useDividerResizeSync(traceScheduler);

  const onLoadScrollStatus = useTraceIssuesOnLoad({
    onTraceLoad,
    event: props.event,
    tree: props.tree,
  });

  return (
    <Fragment>
      <TraceTypeWarnings
        tree={props.tree}
        traceSlug={props.traceSlug}
        organization={organization}
      />
      <IssuesTraceGrid layout={traceState.preferences.layout}>
        <IssuesPointerDisabled>
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
        </IssuesPointerDisabled>

        {props.tree.type === 'loading' || onLoadScrollStatus === 'pending' ? (
          <TraceWaterfallState.Loading />
        ) : props.tree.type === 'error' ? (
          <TraceWaterfallState.Error />
        ) : props.tree.type === 'empty' ? (
          <TraceWaterfallState.Empty />
        ) : null}
      </IssuesTraceGrid>
    </Fragment>
  );
}

const IssuesPointerDisabled = styled('div')`
  position: relative;
  height: 100%;
  width: 100%;
  pointer-events: none;
`;

const IssuesTraceGrid = styled(TraceGrid)<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  display: block;
`;
