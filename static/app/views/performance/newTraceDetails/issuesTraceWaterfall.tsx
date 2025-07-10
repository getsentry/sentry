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

import {getProblemSpansForSpanTree} from 'sentry/components/events/interfaces/performance/utils';
import {getRelativeDate} from 'sentry/components/timeSince';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {IssueTraceWaterfallOverlay} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfallOverlay';
import {
  isEAPErrorNode,
  isEAPSpanNode,
  isEAPTransactionNode,
  isNonTransactionEAPSpanNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {IssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/issuesTraceTree';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useDividerResizeSync} from 'sentry/views/performance/newTraceDetails/useDividerResizeSync';
import {useTraceSpaceListeners} from 'sentry/views/performance/newTraceDetails/useTraceSpaceListeners';

import type {TraceTreeNode} from './traceModels/traceTreeNode';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import {usePerformanceSubscriptionDetails} from './traceTypeWarnings/usePerformanceSubscriptionDetails';
import {Trace} from './trace';
import {traceAnalytics} from './traceAnalytics';
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

interface IssuesTraceWaterfallProps
  extends Omit<TraceWaterfallProps, 'tree' | 'traceWaterfallScrollHandlers' | 'meta'> {
  event: Event;
  tree: IssuesTraceTree;
}

export function IssuesTraceWaterfall(props: IssuesTraceWaterfallProps) {
  const {projects} = useProjects();
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const containerRef = useRef<HTMLDivElement>(null);

  const [forceRender, rerender] = useReducer(x => (x + 1) % Number.MAX_SAFE_INTEGER, 0);

  const problemSpans = useMemo((): ReturnType<typeof getProblemSpansForSpanTree> => {
    if (props.event.type === 'transaction') {
      return getProblemSpansForSpanTree(props.event);
    }

    return {affectedSpanIds: [], focusedSpanIds: []};
  }, [props.event]);

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

  const {viewManager, traceScheduler, traceView} = props.traceWaterfallModels;

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

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  // Callback that is invoked when the trace loads and reaches its initialied state,
  // that is when the trace tree data and any data that the trace depends on is loaded,
  // but the trace is not yet rendered in the view.
  const onTraceLoad = useCallback(() => {
    const traceTimestamp = props.tree.root.children[0]?.space?.[0];
    const traceAge = defined(traceTimestamp)
      ? getRelativeDate(traceTimestamp, 'ago')
      : 'unknown';

    if (!isLoadingSubscriptionDetails) {
      traceAnalytics.trackTraceShape(
        props.tree,
        projectsRef.current,
        props.organization,
        hasExceededPerformanceUsageLimit,
        'issue_details',
        traceAge
      );
    }

    // Construct the visual representation of the tree
    props.tree.build();

    // Find all the nodes that match the event id from the error so that we can try and
    // link the user to the most specific one.
    const nodes = IssuesTraceTree.FindAll(props.tree.root, n => {
      if (isTraceErrorNode(n) || isEAPErrorNode(n)) {
        return n.value.event_id === props.event.eventID;
      }
      if (isTransactionNode(n)) {
        if (n.value.event_id === props.event.eventID) {
          return true;
        }

        for (const e of n.errors) {
          if (e.event_id === props.event.eventID) {
            return true;
          }
        }

        for (const o of n.occurrences) {
          if (o.event_id === props.event.eventID) {
            return true;
          }
        }
      }
      if (isSpanNode(n)) {
        if (n.value.span_id === props.event.eventID) {
          return true;
        }
        for (const e of n.errors) {
          if (e.event_id === props.event.eventID) {
            return true;
          }
        }
        for (const o of n.occurrences) {
          if (o.event_id === props.event.eventID) {
            return true;
          }
        }
      }

      if (isEAPSpanNode(n)) {
        if (n.value.event_id === props.event.eventID) {
          return true;
        }
        for (const e of n.errors) {
          if (e.event_id === props.event.eventID) {
            return true;
          }
        }
        for (const o of n.occurrences) {
          if (o.event_id === props.event.occurrence?.id) {
            return true;
          }
        }
      }
      return false;
    });

    // By order of priority, we want to find the error node, then the span node, then the transaction node.
    // This is because the error node as standalone is the most specific one, otherwise we look for the span that
    // the error may have been attributed to, otherwise we look at the transaction.
    const node =
      nodes?.find(n => isTraceErrorNode(n) || isEAPErrorNode(n)) ||
      nodes?.find(n => isSpanNode(n) || isNonTransactionEAPSpanNode(n)) ||
      nodes?.find(n => isTransactionNode(n) || isEAPTransactionNode(n));

    const index = node ? IssuesTraceTree.EnforceVisibility(props.tree, node) : -1;

    if (node) {
      const preserveNodes: Array<TraceTreeNode<TraceTree.NodeValue>> = [node];

      let start = index;
      while (--start > 0) {
        if (
          isTraceErrorNode(props.tree.list[start]!) ||
          node.errors.size > 0 ||
          node.occurrences.size > 0
        ) {
          preserveNodes.push(props.tree.list[start]!);
          break;
        }
      }

      start = index;
      while (++start < props.tree.list.length) {
        if (
          isTraceErrorNode(props.tree.list[start]!) ||
          node.errors.size > 0 ||
          node.occurrences.size > 0
        ) {
          preserveNodes.push(props.tree.list[start]!);
          break;
        }
      }

      start = 0;
      // Preserve affectedSpanIds
      while (start < props.tree.list.length) {
        const currentNode = props.tree.list[start]!;
        // Add more affected spans up to the minimum number of nodes to keep
        if (preserveNodes.length >= MIN_NODES_TO_KEEP) {
          break;
        }
        if (
          currentNode.value &&
          'span_id' in currentNode.value &&
          // Not already in the preserveNodes array
          !preserveNodes.includes(currentNode) &&
          problemSpans.affectedSpanIds.includes(currentNode.value.span_id)
        ) {
          preserveNodes.push(currentNode);
        }
        start++;
      }

      let numSurroundingNodes = TRACE_PREVIEW_SURROUNDING_NODES;
      if (props.event.type === 'transaction') {
        // Performance issues are tighter to focus on the suspect spans (of which there may be many)
        numSurroundingNodes = PERFORMANCE_ISSUE_SURROUNDING_NODES;
      }

      props.tree.collapseList(preserveNodes, numSurroundingNodes, MIN_NODES_TO_KEEP);
    }

    if (index === -1 || !node) {
      const hasScrollComponent = !!props.event.eventID;
      if (hasScrollComponent) {
        Sentry.withScope(scope => {
          scope.setFingerprint(['trace-view-issesu-scroll-to-node-error']);
          scope.captureMessage('Failed to scroll to node in issues trace tree');
        });
      }

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
          viewManager.scrollRowIntoViewHorizontally(node, 0, 48, 'measured');
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
  }, [
    traceDispatch,
    viewManager,
    traceScheduler,
    props.tree,
    props.organization,
    props.event,
    isLoadingSubscriptionDetails,
    hasExceededPerformanceUsageLimit,
    problemSpans.affectedSpanIds,
  ]);

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
      <IssuesTraceGrid
        layout={traceState.preferences.layout}
        rowCount={
          props.tree.type === 'trace' && onLoadScrollStatus === 'success'
            ? props.tree.list.length
            : 8
        }
      >
        <IssuesTraceContainer ref={containerRef}>
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
              isLoading={
                props.tree.type === 'loading' || onLoadScrollStatus === 'pending'
              }
            />
          </IssuesPointerDisabled>
          <IssueTraceWaterfallOverlay
            containerRef={containerRef}
            event={props.event}
            groupId={props.event.groupID}
            tree={props.tree}
            viewManager={viewManager}
          />
        </IssuesTraceContainer>

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
  pointer-events: none;
  position: relative;
  height: 100%;
  width: 100%;
`;

const ROW_HEIGHT = 24;
const MIN_ROW_COUNT = 1;
const HEADER_HEIGHT = 38;
const MAX_HEIGHT = 24 * ROW_HEIGHT + HEADER_HEIGHT;
const MAX_ROW_COUNT = Math.floor(MAX_HEIGHT / ROW_HEIGHT);
const PERFORMANCE_ISSUE_SURROUNDING_NODES = 2;
const TRACE_PREVIEW_SURROUNDING_NODES = 3;
/**
 * After collapsing surrounding nodes, re-expand to make sure we didn't collapse everything
 */
const MIN_NODES_TO_KEEP = 12;

const IssuesTraceGrid = styled(TraceGrid)<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
  rowCount: number;
}>`
  display: block;
  flex-grow: 1;
  max-height: ${MAX_HEIGHT}px;
  height: ${p =>
    Math.min(Math.max(p.rowCount, MIN_ROW_COUNT), MAX_ROW_COUNT) * ROW_HEIGHT +
    HEADER_HEIGHT}px;
`;

const IssuesTraceContainer = styled('div')`
  position: relative;
  height: 100%;
  width: 100%;
`;
