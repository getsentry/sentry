import type React from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {PlatformIcon} from 'platformicons';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import type {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {clamp} from 'sentry/utils/profiling/colors/utils';
import {replayPlayerTimestampEmitter} from 'sentry/utils/replays/replayPlayerTimestampEmitter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {
  TraceEvents,
  TraceScheduler,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import {
  useVirtualizedList,
  type VirtualizedRow,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceVirtualizedList';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {TraceReducerState} from 'sentry/views/performance/newTraceDetails/traceState';
import {
  getRovingIndexActionFromDOMEvent,
  type RovingTabIndexUserActions,
} from 'sentry/views/performance/newTraceDetails/traceState/traceRovingTabIndex';

import {
  makeTraceNodeBarColor,
  ParentAutogroupNode,
  TraceTree,
  type TraceTreeNode,
} from './traceModels/traceTree';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './guards';
import {TraceIcons} from './icons';

const COUNT_FORMATTER = Intl.NumberFormat(undefined, {notation: 'compact'});
const NO_ERRORS = new Set<TraceError>();
const NO_PERFORMANCE_ISSUES = new Set<TracePerformanceIssue>();
const NO_PROFILES = [];

function computeNextIndexFromAction(
  current_index: number,
  action: RovingTabIndexUserActions,
  items: number
): number {
  switch (action) {
    case 'next':
      if (current_index === items) {
        return 0;
      }
      return current_index + 1;
    case 'previous':
      if (current_index === 0) {
        return items;
      }
      return current_index - 1;
    case 'last':
      return items;
    case 'first':
      return 0;
    default:
      throw new TypeError(`Invalid or not implemented reducer action - ${action}`);
  }
}

function getMaxErrorSeverity(errors: TraceTree.TraceError[]) {
  return errors.reduce((acc, error) => {
    if (error.level === 'fatal') {
      return 'fatal';
    }
    if (error.level === 'error') {
      return acc === 'fatal' ? 'fatal' : 'error';
    }
    if (error.level === 'warning') {
      return acc === 'fatal' || acc === 'error' ? acc : 'warning';
    }
    return acc;
  }, 'default');
}

const RIGHT_COLUMN_EVEN_CLASSNAME = `TraceRightColumn`;
const RIGHT_COLUMN_ODD_CLASSNAME = [RIGHT_COLUMN_EVEN_CLASSNAME, 'Odd'].join(' ');
const CHILDREN_COUNT_WRAPPER_CLASSNAME = `TraceChildrenCountWrapper`;
const CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME = [
  CHILDREN_COUNT_WRAPPER_CLASSNAME,
  'Orphaned',
].join(' ');

const ERROR_LEVEL_LABELS: Record<keyof Theme['level'], string> = {
  sample: t('Sample'),
  info: t('Info'),
  warning: t('Warning'),
  // Hardcoded legacy color (orange400). We no longer use orange anywhere
  // else in the app (except for the chart palette). This needs to be harcoded
  // here because existing users may still associate orange with the "error" level.
  error: t('Error'),
  fatal: t('Fatal'),
  default: t('Default'),
  unknown: t('Unknown'),
};

function maybeFocusRow(
  ref: HTMLDivElement | null,
  node: TraceTreeNode<TraceTree.NodeValue>,
  previouslyFocusedNodeRef: React.MutableRefObject<TraceTreeNode<TraceTree.NodeValue> | null>
) {
  if (!ref) return;
  if (node === previouslyFocusedNodeRef.current) return;
  previouslyFocusedNodeRef.current = node;
  ref.focus();
}

interface TraceProps {
  forceRerender: number;
  initializedRef: React.MutableRefObject<boolean>;
  isEmbedded: boolean;
  manager: VirtualizedViewManager;
  onRowClick: (
    node: TraceTreeNode<TraceTree.NodeValue>,
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => void;
  onTraceLoad: (
    trace: TraceTree,
    node: TraceTreeNode<TraceTree.NodeValue> | null,
    index: number | null
  ) => void;
  onTraceSearch: (
    query: string,
    node: TraceTreeNode<TraceTree.NodeValue>,
    behavior: 'track result' | 'persist'
  ) => void;
  previouslyFocusedNodeRef: React.MutableRefObject<TraceTreeNode<TraceTree.NodeValue> | null>;
  rerender: () => void;
  scheduler: TraceScheduler;
  scrollQueueRef: React.MutableRefObject<
    | {
        eventId?: string;
        path?: TraceTree.NodePath[];
      }
    | null
    | undefined
  >;
  trace: TraceTree;
  trace_id: string | undefined;
}

export function Trace({
  trace,
  onRowClick,
  manager,
  scrollQueueRef,
  previouslyFocusedNodeRef,
  onTraceSearch,
  onTraceLoad,
  rerender,
  scheduler,
  initializedRef,
  forceRerender,
  trace_id,
  isEmbedded,
}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();

  const rerenderRef = useRef<TraceProps['rerender']>(rerender);
  rerenderRef.current = rerender;

  const treePromiseStatusRef =
    useRef<Map<TraceTreeNode<TraceTree.NodeValue>, 'loading' | 'error' | 'success'>>();

  if (!treePromiseStatusRef.current) {
    treePromiseStatusRef.current = new Map();
  }

  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  useLayoutEffect(() => {
    const onTraceViewChange: TraceEvents['set trace view'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.syncResetZoomButton();
      manager.draw();
    };
    const onPhysicalSpaceChange: TraceEvents['set container physical space'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw();
    };
    const onTraceSpaceChange: TraceEvents['initialize trace space'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw();
    };
    const onDividerResize: TraceEvents['divider resize'] = view => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw(view);
    };

    scheduler.on('set trace view', onTraceViewChange);
    scheduler.on('set trace space', onTraceSpaceChange);
    scheduler.on('set container physical space', onPhysicalSpaceChange);
    scheduler.on('initialize trace space', onTraceSpaceChange);
    scheduler.on('divider resize', onDividerResize);

    return () => {
      scheduler.off('set trace view', onTraceViewChange);
      scheduler.off('set trace space', onTraceSpaceChange);
      scheduler.off('set container physical space', onPhysicalSpaceChange);
      scheduler.off('initialize trace space', onTraceSpaceChange);
      scheduler.off('divider resize', onDividerResize);
    };
  }, [manager, scheduler]);

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
      ? TraceTree.ExpandToPath(trace, scrollQueueRef.current.path, rerenderRef.current, {
          api,
          organization,
        })
      : scrollQueueRef.current.eventId
        ? TraceTree.ExpandToEventID(
            scrollQueueRef?.current?.eventId,
            trace,
            rerenderRef.current,
            {
              api,
              organization,
            }
          )
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
        rerenderRef.current();
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
    traceDispatch,
    scrollQueueRef,
    initializedRef,
    organization,
  ]);

  const onNodeZoomIn = useCallback(
    (
      event: React.MouseEvent<Element> | React.KeyboardEvent<Element>,
      node: TraceTreeNode<TraceTree.NodeValue>,
      value: boolean
    ) => {
      if (!isTransactionNode(node) && !isSpanNode(node)) {
        throw new TypeError('Node must be a transaction or span');
      }

      event.stopPropagation();
      rerenderRef.current();

      treeRef.current
        .zoomIn(node, value, {
          api,
          organization,
        })
        .then(() => {
          rerenderRef.current();

          // If a query exists, we want to reapply the search after zooming in
          // so that new nodes are also highlighted if they match a query
          if (traceStateRef.current.search.query) {
            onTraceSearch(traceStateRef.current.search.query, node, 'persist');
          }

          treePromiseStatusRef.current!.set(node, 'success');
        })
        .catch(_e => {
          treePromiseStatusRef.current!.set(node, 'error');
        });
    },
    [api, organization, onTraceSearch]
  );

  const onNodeExpand = useCallback(
    (
      event: React.MouseEvent<Element> | React.KeyboardEvent<Element>,
      node: TraceTreeNode<TraceTree.NodeValue>,
      value: boolean
    ) => {
      event.stopPropagation();

      treeRef.current.expand(node, value);
      rerenderRef.current();

      if (traceStateRef.current.search.query) {
        // If a query exists, we want to reapply the search after expanding
        // so that new nodes are also highlighted if they match a query
        onTraceSearch(traceStateRef.current.search.query, node, 'persist');
      }
    },
    [onTraceSearch]
  );

  const onRowKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      index: number,
      node: TraceTreeNode<TraceTree.NodeValue>
    ) => {
      if (!manager.list) {
        return;
      }
      const action = getRovingIndexActionFromDOMEvent(event);
      if (action) {
        event.preventDefault();
        const nextIndex = computeNextIndexFromAction(
          index,
          action,
          treeRef.current.list.length - 1
        );

        traceDispatch({
          type: 'set roving index',
          index: nextIndex,
          node: treeRef.current.list[nextIndex],
          action_source: 'keyboard',
        });
      }
      if (event.key === 'ArrowLeft') {
        if (node.zoomedIn) onNodeZoomIn(event, node, false);
        else if (node.expanded) onNodeExpand(event, node, false);
      } else if (event.key === 'ArrowRight') {
        if (!node.expanded) onNodeExpand(event, node, true);
        else if (node.expanded && node.canFetch) onNodeZoomIn(event, node, true);
      }
    },
    [manager, onNodeExpand, onNodeZoomIn, traceDispatch]
  );

  const projectLookup: Record<string, PlatformKey | undefined> = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project['platform']>>(
      (acc, project) => {
        acc[project.slug] = project.platform;
        return acc;
      },
      {}
    );
  }, [projects]);

  const renderLoadingRow = useCallback(
    (n: VirtualizedRow) => {
      return (
        <RenderPlaceholderRow
          key={n.key}
          index={n.index}
          style={n.style}
          node={n.item}
          theme={theme}
          manager={manager}
        />
      );
    },
    [manager, theme]
  );

  const renderVirtualizedRow = useCallback(
    (n: VirtualizedRow) => {
      return (
        <RenderRow
          key={n.key}
          index={n.index}
          organization={organization}
          previouslyFocusedNodeRef={previouslyFocusedNodeRef}
          tabIndex={traceState.rovingTabIndex.node === n.item ? 0 : -1}
          isSearchResult={traceState.search.resultsLookup.has(n.item)}
          searchResultsIteratorIndex={traceState.search.resultIndex}
          style={n.style}
          projects={projectLookup}
          node={n.item}
          manager={manager}
          theme={theme}
          onExpand={onNodeExpand}
          onZoomIn={onNodeZoomIn}
          onRowClick={onRowClick}
          onRowKeyDown={onRowKeyDown}
          tree={trace}
          trace_id={trace_id}
          isEmbedded={isEmbedded}
        />
      );
    },
    // we add forceRerender as a "unnecessary" dependency to trigger the virtualized list rerender
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      onNodeExpand,
      onNodeZoomIn,
      manager,
      scrollQueueRef,
      previouslyFocusedNodeRef,
      onRowKeyDown,
      onRowClick,
      organization,
      projectLookup,
      traceState.rovingTabIndex.node,
      traceState.search.resultIteratorIndex,
      traceState.search.resultsLookup,
      traceState.search.resultIndex,
      theme,
      trace.type,
      forceRerender,
    ]
  );

  const render = useMemo(() => {
    return trace.type !== 'trace' || scrollQueueRef.current
      ? r => renderLoadingRow(r)
      : r => renderVirtualizedRow(r);
  }, [renderLoadingRow, renderVirtualizedRow, trace.type, scrollQueueRef]);

  const traceNode = trace.root.children[0];
  const traceStartTimestamp = traceNode?.space?.[0];

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const virtualizedList = useVirtualizedList({
    manager,
    items: trace.list,
    container: scrollContainer,
    render: render,
    scheduler,
  });

  return (
    <TraceStylingWrapper
      ref={manager.registerContainerRef}
      className={`
        ${trace.root.space[1] === 0 ? 'Empty' : ''}
        ${trace.indicators.length > 0 ? 'WithIndicators' : ''}
        ${trace.type !== 'trace' || scrollQueueRef.current ? 'Loading' : ''}
        ${ConfigStore.get('theme')}`}
    >
      <div
        className="TraceScrollbarContainer"
        ref={manager.registerHorizontalScrollBarContainerRef}
      >
        <div className="TraceScrollbarScroller" />
      </div>
      <div className="TraceDivider" ref={manager.registerDividerRef} />
      <div
        className="TraceIndicatorContainer"
        ref={manager.registerIndicatorContainerRef}
      >
        {trace.indicators.length > 0
          ? trace.indicators.map((indicator, i) => {
              return (
                <div
                  key={i}
                  ref={r => manager.registerIndicatorRef(r, i, indicator)}
                  className={`TraceIndicator ${indicator.poor ? 'Errored' : ''}`}
                >
                  <div className="TraceIndicatorLabel">{indicator.label}</div>
                  <div className="TraceIndicatorLine" />
                </div>
              );
            })
          : null}

        {manager.interval_bars.map((_, i) => {
          const indicatorTimestamp = manager.intervals[i] ?? 0;

          if (trace.type !== 'trace') {
            return null;
          }

          return (
            <div
              key={i}
              ref={r => manager.registerTimelineIndicatorRef(r, i)}
              className="TraceIndicator Timeline"
            >
              <div className="TraceIndicatorLabel">
                {indicatorTimestamp > 0
                  ? formatTraceDuration(manager.view.trace_view.x + indicatorTimestamp)
                  : '0s'}
              </div>
              <div className="TraceIndicatorLine" />
            </div>
          );
        })}
        {traceNode && traceStartTimestamp ? (
          <VerticalTimestampIndicators
            viewmanager={manager}
            traceStartTimestamp={traceStartTimestamp}
          />
        ) : null}
      </div>
      <div
        ref={setScrollContainer}
        data-test-id="trace-virtualized-list-scroll-container"
      >
        <div data-test-id="trace-virtualized-list">{virtualizedList.rendered}</div>
        <div className="TraceRow Hidden">
          <div
            className="TraceLeftColumn"
            ref={r => manager.registerGhostRowRef('list', r)}
          />
          <div
            className="TraceRightColumn"
            ref={r => manager.registerGhostRowRef('span_list', r)}
          />
        </div>
      </div>
    </TraceStylingWrapper>
  );
}

function RenderRow(props: {
  index: number;
  isEmbedded: boolean;
  isSearchResult: boolean;
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.NodeValue>;
  onExpand: (
    event: React.MouseEvent<Element>,
    node: TraceTreeNode<TraceTree.NodeValue>,
    value: boolean
  ) => void;
  onRowClick: (
    node: TraceTreeNode<TraceTree.NodeValue>,
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => void;
  onRowKeyDown: (
    event: React.KeyboardEvent,
    index: number,
    node: TraceTreeNode<TraceTree.NodeValue>
  ) => void;
  onZoomIn: (
    event: React.MouseEvent<Element>,
    node: TraceTreeNode<TraceTree.NodeValue>,
    value: boolean
  ) => void;
  organization: Organization;
  previouslyFocusedNodeRef: React.MutableRefObject<TraceTreeNode<TraceTree.NodeValue> | null>;
  projects: Record<Project['slug'], Project['platform']>;
  searchResultsIteratorIndex: number | null;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string | undefined;
  tree: TraceTree;
}) {
  const virtualized_index = props.index - props.manager.start_virtualized_index;
  const rowSearchClassName = `${props.isSearchResult ? 'SearchResult' : ''} ${props.searchResultsIteratorIndex === props.index ? 'Highlight' : ''}`;

  const registerListColumnRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerColumnRef('list', ref, virtualized_index, props.node);
    },
    [props.manager, props.node, virtualized_index]
  );

  const registerSpanColumnRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerColumnRef('span_list', ref, virtualized_index, props.node);
    },
    [props.manager, props.node, virtualized_index]
  );

  const registerSpanArrowRef = useCallback(
    ref => {
      props.manager.registerArrowRef(ref, props.node.space!, virtualized_index);
    },
    [props.manager, props.node, virtualized_index]
  );

  const onRowClickProp = props.onRowClick;
  const onRowClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onRowClickProp(props.node, event, props.index);
    },
    [props.index, props.node, onRowClickProp]
  );

  const onKeyDownProp = props.onRowKeyDown;
  const onRowKeyDown = useCallback(
    event => onKeyDownProp(event, props.index, props.node),
    [props.index, props.node, onKeyDownProp]
  );

  const onRowDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      trackAnalytics('trace.trace_layout.zoom_to_fill', {
        organization: props.organization,
      });
      e.stopPropagation();
      props.manager.onZoomIntoSpace(props.node.space!);
    },
    [props.node, props.manager, props.organization]
  );

  const onSpanRowArrowClick = useCallback(
    (_e: React.MouseEvent) => {
      props.manager.onBringRowIntoView(props.node.space!);
    },
    [props.node.space, props.manager]
  );

  const onExpandProp = props.onExpand;
  const onExpandClick = useCallback(
    (e: React.MouseEvent) => {
      onExpandProp(e, props.node, !props.node.expanded);
    },
    [props.node, onExpandProp]
  );

  const onExpandDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const spanColumnClassName =
    props.index % 2 === 1 ? RIGHT_COLUMN_ODD_CLASSNAME : RIGHT_COLUMN_EVEN_CLASSNAME;

  const listColumnClassName = props.node.isOrphaned
    ? CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME
    : CHILDREN_COUNT_WRAPPER_CLASSNAME;

  const listColumnStyle: React.CSSProperties = {
    paddingLeft: props.node.depth * props.manager.row_depth_padding,
  };

  if (isAutogroupedNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`Autogrouped TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />
              <ChildrenButton
                icon={
                  <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                }
                status={props.node.fetchStatus}
                expanded={!props.node.expanded}
                onClick={onExpandClick}
                onDoubleClick={onExpandDoubleClick}
              >
                {COUNT_FORMATTER.format(props.node.groupCount)}
              </ChildrenButton>
            </div>

            <span className="TraceOperation">{t('Autogrouped')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.node.value.autogrouped_by.op}</span>
          </div>
        </div>
        <div
          className={spanColumnClassName}
          ref={registerSpanColumnRef}
          onDoubleClick={onRowDoubleClick}
        >
          <AutogroupedTraceBar
            manager={props.manager}
            entire_space={props.node.space}
            errors={props.node.errors}
            virtualized_index={virtualized_index}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_spaces={props.node.autogroupedSegments}
            performance_issues={props.node.performance_issues}
            profiles={props.node.profiles}
          />
          <button
            ref={registerSpanArrowRef}
            className="TraceArrow"
            onClick={onSpanRowArrowClick}
          >
            <TraceIcons.Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isTransactionNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onKeyDown={onRowKeyDown}
        onClick={onRowClick}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            <div className={listColumnClassName}>
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={
                    props.node.canFetch ? (
                      props.node.fetchStatus === 'idle' ? (
                        '+'
                      ) : props.node.zoomedIn ? (
                        <TraceIcons.Chevron direction="up" />
                      ) : (
                        '+'
                      )
                    ) : (
                      <TraceIcons.Chevron
                        direction={props.node.expanded ? 'up' : 'down'}
                      />
                    )
                  }
                  status={props.node.fetchStatus}
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onDoubleClick={onExpandDoubleClick}
                  onClick={e => {
                    props.node.canFetch
                      ? props.onZoomIn(e, props.node, !props.node.zoomedIn)
                      : props.onExpand(e, props.node, !props.node.expanded);
                  }}
                >
                  {props.node.children.length > 0
                    ? COUNT_FORMATTER.format(props.node.children.length)
                    : null}
                </ChildrenButton>
              ) : null}
            </div>
            <PlatformIcon
              platform={props.projects[props.node.value.project_slug] ?? 'default'}
            />
            <span className="TraceOperation">{props.node.value['transaction.op']}</span>
            <strong className="TraceEmDash"> — </strong>
            <span>{props.node.value.transaction}</span>
          </div>
        </div>
        <div
          ref={registerSpanColumnRef}
          className={spanColumnClassName}
          onDoubleClick={onRowDoubleClick}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_space={props.node.space}
            errors={props.node.errors}
            performance_issues={props.node.performance_issues}
            profiles={props.node.profiles}
          />
          <button
            ref={registerSpanArrowRef}
            className="TraceArrow"
            onClick={onSpanRowArrowClick}
          >
            <TraceIcons.Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isSpanNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            <div className={listColumnClassName}>
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={
                    props.node.canFetch ? (
                      '+'
                    ) : (
                      <TraceIcons.Chevron
                        direction={props.node.expanded ? 'up' : 'down'}
                      />
                    )
                  }
                  status={props.node.fetchStatus}
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onDoubleClick={onExpandDoubleClick}
                  onClick={e =>
                    props.node.canFetch
                      ? props.onZoomIn(e, props.node, !props.node.zoomedIn)
                      : props.onExpand(e, props.node, !props.node.expanded)
                  }
                >
                  {props.node.children.length > 0
                    ? COUNT_FORMATTER.format(props.node.children.length)
                    : null}
                </ChildrenButton>
              ) : null}
            </div>
            <span className="TraceOperation">{props.node.value.op ?? '<unknown>'}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription" title={props.node.value.description}>
              {!props.node.value.description
                ? props.node.value.span_id ?? 'unknown'
                : props.node.value.description.length > 100
                  ? props.node.value.description.slice(0, 100).trim() + '\u2026'
                  : props.node.value.description}
            </span>
          </div>
        </div>
        <div
          ref={registerSpanColumnRef}
          className={spanColumnClassName}
          onDoubleClick={onRowDoubleClick}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_space={props.node.space}
            errors={props.node.errors}
            performance_issues={props.node.performance_issues}
            profiles={NO_PROFILES}
          />
          <button
            ref={registerSpanArrowRef}
            className="TraceArrow"
            onClick={onSpanRowArrowClick}
          >
            <TraceIcons.Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isMissingInstrumentationNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />
            </div>
            <span className="TraceOperation">{t('Missing instrumentation')}</span>
          </div>
        </div>
        <div
          ref={registerSpanColumnRef}
          className={spanColumnClassName}
          onDoubleClick={onRowDoubleClick}
        >
          <MissingInstrumentationTraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_space={props.node.space}
          />
          <button
            ref={registerSpanArrowRef}
            className="TraceArrow"
            onClick={onSpanRowArrowClick}
          >
            <TraceIcons.Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isTraceNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            {' '}
            <div className="TraceChildrenCountWrapper Root">
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={''}
                  status={props.node.fetchStatus}
                  expanded
                  onClick={() => void 0}
                  onDoubleClick={onExpandDoubleClick}
                >
                  {props.node.fetchStatus === 'loading'
                    ? null
                    : props.node.children.length > 0
                      ? COUNT_FORMATTER.format(props.node.children.length)
                      : null}
                </ChildrenButton>
              ) : null}
            </div>
            <span className="TraceOperation">{t('Trace')}</span>
            {props.trace_id ? (
              <Fragment>
                <strong className="TraceEmDash"> — </strong>
                <span className="TraceDescription">{props.trace_id}</span>
              </Fragment>
            ) : null}
          </div>
        </div>
        <div
          ref={registerSpanColumnRef}
          className={spanColumnClassName}
          onDoubleClick={onRowDoubleClick}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_space={props.node.space}
            errors={NO_ERRORS}
            performance_issues={NO_PERFORMANCE_ISSUES}
            profiles={NO_PROFILES}
          />
          <button
            ref={registerSpanArrowRef}
            className="TraceArrow"
            onClick={onSpanRowArrowClick}
          >
            <TraceIcons.Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isTraceErrorNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0 && !props.isEmbedded
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.max_severity}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        style={props.style}
      >
        <div className="TraceLeftColumn" ref={registerListColumnRef}>
          <div
            className="TraceLeftColumnInner"
            style={listColumnStyle}
            onDoubleClick={onRowDoubleClick}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />{' '}
            </div>
            <PlatformIcon
              platform={props.projects[props.node.value.project_slug] ?? 'default'}
            />
            <span className="TraceOperation">
              {ERROR_LEVEL_LABELS[props.node.value.level ?? 'error']}
            </span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">
              {props.node.value.message ?? props.node.value.title}
            </span>
          </div>
        </div>
        <div
          ref={registerSpanColumnRef}
          className={spanColumnClassName}
          onDoubleClick={onRowDoubleClick}
        >
          <InvisibleTraceBar
            node_space={props.node.space}
            manager={props.manager}
            virtualizedIndex={virtualized_index}
          >
            {typeof props.node.value.timestamp === 'number' ? (
              <div className={`TraceIcon ${props.node.value.level}`}>
                <TraceIcons.Icon event={props.node.value} />
              </div>
            ) : null}
          </InvisibleTraceBar>
        </div>
      </div>
    );
  }

  return null;
}

function RenderPlaceholderRow(props: {
  index: number;
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.NodeValue>;
  style: React.CSSProperties;
  theme: Theme;
}) {
  return (
    <div
      key={props.index}
      className="TraceRow"
      style={{
        transform: props.style.transform,
        height: props.style.height,
        pointerEvents: 'none',
        color: props.theme.subText,
        paddingLeft: 8,
      }}
    >
      <div
        className="TraceLeftColumn"
        style={{width: props.manager.columns.list.width * 100 + '%'}}
      >
        <div
          className="TraceLeftColumnInner"
          style={{
            paddingLeft: props.node.depth * props.manager.row_depth_padding,
          }}
        >
          <div
            className={`TraceChildrenCountWrapper ${isTraceNode(props.node) ? 'Root' : ''}`}
          >
            <Connectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.canFetch ? (
              <ChildrenButton
                icon="+"
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.zoomedIn}
                onClick={() => void 0}
                onDoubleClick={() => void 0}
              >
                {props.node.children.length > 0
                  ? COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </ChildrenButton>
            ) : null}
          </div>
          <Placeholder
            className="Placeholder"
            height="12px"
            width={randomBetween(20, 80) + '%'}
            style={{
              transition: 'all 30s ease-out',
            }}
          />
        </div>
      </div>
      <div
        className={
          props.index % 2 === 1 ? RIGHT_COLUMN_ODD_CLASSNAME : RIGHT_COLUMN_EVEN_CLASSNAME
        }
        style={{
          width: props.manager.columns.span_list.width * 100 + '%',
        }}
      >
        <Placeholder
          className="Placeholder"
          height="12px"
          width={randomBetween(20, 80) + '%'}
          style={{
            transition: 'all 30s ease-out',
            transform: `translate(${randomBetween(0, 200) + 'px'}, 0)`,
          }}
        />
      </div>
    </div>
  );
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function Connectors(props: {
  manager: VirtualizedViewManager;
  node: TraceTreeNode<TraceTree.NodeValue>;
}) {
  const hasChildren =
    (props.node.expanded || props.node.zoomedIn) && props.node.children.length > 0;
  const showVerticalConnector =
    hasChildren || (props.node.value && isParentAutogroupedNode(props.node));

  // If the tail node of the collapsed node has no children,
  // we don't want to render the vertical connector as no children
  // are being rendered as the chain is entirely collapsed
  const hideVerticalConnector =
    showVerticalConnector &&
    props.node.value &&
    props.node instanceof ParentAutogroupNode &&
    (!props.node.tail.children.length ||
      (!props.node.tail.expanded && !props.node.expanded));

  return (
    <Fragment>
      {props.node.connectors.map((c, i) => {
        return (
          <span
            key={i}
            style={{
              left: -(
                Math.abs(Math.abs(c) - props.node.depth) * props.manager.row_depth_padding
              ),
            }}
            className={`TraceVerticalConnector ${c < 0 ? 'Orphaned' : ''}`}
          />
        );
      })}
      {showVerticalConnector && !hideVerticalConnector ? (
        <span className="TraceExpandedVerticalConnector" />
      ) : null}
      {props.node.isLastChild ? (
        <span className="TraceVerticalLastChildConnector" />
      ) : (
        <span className="TraceVerticalConnector" />
      )}
    </Fragment>
  );
}

function ChildrenButton(props: {
  children: React.ReactNode;
  expanded: boolean;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  status: TraceTreeNode<any>['fetchStatus'] | undefined;
}) {
  return (
    <button
      className={`TraceChildrenCount`}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
    >
      <div className="TraceChildrenCountContent">{props.children}</div>
      <div className="TraceChildrenCountAction">
        {props.icon}
        {props.status === 'loading' ? (
          <LoadingIndicator className="TraceActionsLoadingIndicator" size={8} />
        ) : null}
      </div>
    </button>
  );
}

interface TraceBarProps {
  color: string;
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
  profiles: TraceTreeNode<TraceTree.NodeValue>['profiles'];
  virtualized_index: number;
}

function TraceBar(props: TraceBarProps) {
  const duration = props.node_space ? formatTraceDuration(props.node_space[1]) : null;

  const registerSpanBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarRef(
        ref,
        props.node_space!,
        props.color,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.color, props.virtualized_index]
  );

  const registerSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.node_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.virtualized_index, duration]
  );

  if (!props.node_space) {
    return null;
  }

  return (
    <Fragment>
      <div ref={registerSpanBarRef} className="TraceBar">
        {props.errors.size > 0 ? (
          <ErrorIcons
            node_space={props.node_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.size > 0 ? (
          <PerformanceIssueIcons
            node_space={props.node_space}
            performance_issues={props.performance_issues}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.size > 0 ||
        props.errors.size > 0 ||
        props.profiles.length > 0 ? (
          <BackgroundPatterns
            node_space={props.node_space}
            performance_issues={props.performance_issues}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
      </div>
      <div ref={registerSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}

interface MissingInstrumentationTraceBarProps {
  color: string;
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  virtualized_index: number;
}
function MissingInstrumentationTraceBar(props: MissingInstrumentationTraceBarProps) {
  const duration = props.node_space ? formatTraceDuration(props.node_space[1]) : null;

  const registerSpanBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarRef(
        ref,
        props.node_space!,
        props.color,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.color, props.virtualized_index]
  );

  const registerSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.node_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.virtualized_index, duration]
  );

  return (
    <Fragment>
      <div ref={registerSpanBarRef} className="TraceBar">
        <div className="TracePatternContainer">
          <div className="TracePattern missing_instrumentation" />
        </div>
      </div>
      <div ref={registerSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}

interface InvisibleTraceBarProps {
  children: React.ReactNode;
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  virtualizedIndex: number;
}

function InvisibleTraceBar(props: InvisibleTraceBarProps) {
  const registerInvisibleBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerInvisibleBarRef(
        ref,
        props.node_space!,
        props.virtualizedIndex
      );
    },
    [props.manager, props.node_space, props.virtualizedIndex]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      props.manager.onZoomIntoSpace(props.node_space!);
    },
    [props.manager, props.node_space]
  );

  if (!props.node_space || !props.children) {
    return null;
  }

  return (
    <div
      ref={registerInvisibleBarRef}
      onDoubleClick={onDoubleClick}
      className="TraceBar Invisible"
    >
      {props.children}
    </div>
  );
}

interface BackgroundPatternsProps {
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
}

function BackgroundPatterns(props: BackgroundPatternsProps) {
  const performance_issues = useMemo(() => {
    if (!props.performance_issues.size) return [];
    return [...props.performance_issues];
  }, [props.performance_issues]);

  const errors = useMemo(() => {
    if (!props.errors.size) return [];
    return [...props.errors];
  }, [props.errors]);

  const severity = useMemo(() => {
    return getMaxErrorSeverity(errors);
  }, [errors]);

  if (!props.performance_issues.size && !props.errors.size) {
    return null;
  }

  // If there is an error, render the error pattern across the entire width.
  // Else if there is a performance issue, render the performance issue pattern
  // for the duration of the performance issue. If there is a profile, render
  // the profile pattern for entire duration (we do not have profile durations here)
  return (
    <Fragment>
      {errors.length > 0 ? (
        <div
          className="TracePatternContainer"
          style={{
            left: 0,
            width: '100%',
          }}
        >
          <div className={`TracePattern ${severity}`} />
        </div>
      ) : performance_issues.length > 0 ? (
        <Fragment>
          {performance_issues.map((issue, i) => {
            const timestamp = issue.start * 1e3;
            // Clamp the issue timestamp to the span's timestamp
            const left = props.manager.computeRelativeLeftPositionFromOrigin(
              clamp(
                timestamp,
                props.node_space![0],
                props.node_space![0] + props.node_space![1]
              ),
              props.node_space!
            );

            return (
              <div
                key={i}
                className="TracePatternContainer"
                style={{
                  left: left * 100 + '%',
                  width: (1 - left) * 100 + '%',
                }}
              >
                <div className="TracePattern performance_issue" />
              </div>
            );
          })}
        </Fragment>
      ) : null}
    </Fragment>
  );
}

interface ErrorIconsProps {
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
}

function ErrorIcons(props: ErrorIconsProps) {
  const errors = useMemo(() => {
    return [...props.errors];
  }, [props.errors]);

  if (!props.errors.size) {
    return null;
  }

  return (
    <Fragment>
      {errors.map((error, i) => {
        const timestamp = error.timestamp ? error.timestamp * 1e3 : props.node_space![0];
        // Clamp the error timestamp to the span's timestamp
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          clamp(
            timestamp,
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          ),
          props.node_space!
        );

        return (
          <div
            key={i}
            className={`TraceIcon ${error.level}`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={error} />
          </div>
        );
      })}
    </Fragment>
  );
}

interface PerformanceIssueIconsProps {
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
}

function PerformanceIssueIcons(props: PerformanceIssueIconsProps) {
  const performance_issues = useMemo(() => {
    return [...props.performance_issues];
  }, [props.performance_issues]);

  if (!props.performance_issues.size) {
    return null;
  }

  return (
    <Fragment>
      {performance_issues.map((issue, i) => {
        const timestamp = issue.timestamp
          ? issue.timestamp * 1e3
          : issue.start
            ? issue.start * 1e3
            : props.node_space![0];
        // Clamp the issue timestamp to the span's timestamp
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          clamp(
            timestamp,
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          ),
          props.node_space!
        );

        return (
          <div
            key={i}
            className={`TraceIcon performance_issue`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={issue} />
          </div>
        );
      })}
    </Fragment>
  );
}

interface AutogroupedTraceBarProps {
  color: string;
  entire_space: [number, number] | null;
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_spaces: [number, number][];
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
  profiles: TraceTreeNode<TraceTree.NodeValue>['profiles'];
  virtualized_index: number;
}

function AutogroupedTraceBar(props: AutogroupedTraceBarProps) {
  const duration = props.entire_space ? formatTraceDuration(props.entire_space[1]) : null;

  const registerInvisibleBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerInvisibleBarRef(
        ref,
        props.entire_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.entire_space, props.virtualized_index]
  );

  const registerAutogroupedSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.entire_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.entire_space, props.virtualized_index, duration]
  );

  if (props.node_spaces && props.node_spaces.length <= 1) {
    return (
      <TraceBar
        color={props.color}
        node_space={props.entire_space}
        manager={props.manager}
        virtualized_index={props.virtualized_index}
        errors={props.errors}
        performance_issues={props.performance_issues}
        profiles={props.profiles}
      />
    );
  }

  if (!props.node_spaces || !props.entire_space) {
    return null;
  }

  return (
    <Fragment>
      <div ref={registerInvisibleBarRef} className="TraceBar Invisible">
        {props.node_spaces.map((node_space, i) => {
          const width = node_space[1] / props.entire_space![1];
          const left = props.manager.computeRelativeLeftPositionFromOrigin(
            node_space[0],
            props.entire_space!
          );
          return (
            <div
              key={i}
              className="TraceBar"
              style={{
                left: `${left * 100}%`,
                width: `${width * 100}%`,
                backgroundColor: props.color,
              }}
            />
          );
        })}
        {/* Autogrouped bars only render icons. That is because in the case of multiple bars
            with tiny gaps, the background pattern looks broken as it does not repeat nicely */}
        {props.errors.size > 0 ? (
          <ErrorIcons
            node_space={props.entire_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.size > 0 ? (
          <PerformanceIssueIcons
            node_space={props.entire_space}
            performance_issues={props.performance_issues}
            manager={props.manager}
          />
        ) : null}
      </div>
      <div ref={registerAutogroupedSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}

function VerticalTimestampIndicators({
  viewmanager,
  traceStartTimestamp,
}: {
  traceStartTimestamp: number;
  viewmanager: VirtualizedViewManager;
}) {
  useEffect(() => {
    function replayTimestampListener({
      currentTime,
      currentHoverTime,
    }: {
      currentHoverTime: number | undefined;
      currentTime: number;
    }) {
      if (viewmanager.vertical_indicators['replay_timestamp.current']) {
        viewmanager.vertical_indicators['replay_timestamp.current'].timestamp =
          traceStartTimestamp + currentTime;
      }

      if (viewmanager.vertical_indicators['replay_timestamp.hover']) {
        viewmanager.vertical_indicators['replay_timestamp.hover'].timestamp =
          currentHoverTime ? traceStartTimestamp + currentHoverTime : undefined;
      }

      // When timestamp is changing, it needs to be redrawn
      // if it is out of bounds, we need to scroll to it
      viewmanager.drawVerticalIndicators();
      viewmanager.maybeSyncViewWithVerticalIndicator('replay_timestamp.current');
    }

    replayPlayerTimestampEmitter.on('replay timestamp change', replayTimestampListener);

    return () => {
      replayPlayerTimestampEmitter.off(
        'replay timestamp change',
        replayTimestampListener
      );
    };
  }, [traceStartTimestamp, viewmanager]);

  const registerReplayCurrentTimestampRef = useCallback(
    (ref: HTMLDivElement | null) => {
      viewmanager.registerVerticalIndicator('replay_timestamp.current', {
        ref,
        timestamp: undefined,
      });
    },
    [viewmanager]
  );

  const registerReplayHoverTimestampRef = useCallback(
    (ref: HTMLDivElement | null) => {
      viewmanager.registerVerticalIndicator('replay_timestamp.hover', {
        ref,
        timestamp: undefined,
      });
    },
    [viewmanager]
  );

  return (
    <Fragment>
      <div ref={registerReplayCurrentTimestampRef} className="TraceIndicator Timeline">
        <div className="Indicator CurrentReplayTimestamp" />
      </div>
      <div ref={registerReplayHoverTimestampRef} className="TraceIndicator Timeline">
        <div className="Indicator HoverReplayTimestamp" />
      </div>
    </Fragment>
  );
}

/**
 * This is a wrapper around the Trace component to apply styles
 * to the trace tree. It exists because we _do not_ want to trigger
 * emotion's css parsing logic as it is very slow and will cause
 * the scrolling to flicker.
 */
const TraceStylingWrapper = styled('div')`
  margin: auto;
  overscroll-behavior: none;
  box-shadow: 0 0 0 1px ${p => p.theme.border};
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  grid-area: trace;
  padding-top: 26px;

  --info: ${p => p.theme.purple400};
  --warning: ${p => p.theme.yellow300};
  --debug: ${p => p.theme.blue300};
  --error: ${p => p.theme.error};
  --fatal: ${p => p.theme.error};
  --default: ${p => p.theme.gray300};
  --unknown: ${p => p.theme.gray300};
  --profile: ${p => p.theme.purple300};
  --autogrouped: ${p => p.theme.blue300};
  --performance-issue: ${p => p.theme.blue300};

  &.WithIndicators {
    padding-top: 44px;

    &:before {
      height: 44px;

      .TraceScrollbarContainer {
        height: 44px;
      }
    }

    .TraceIndicator.Timeline {
      .TraceIndicatorLabel {
        top: 26px;
      }

      .TraceIndicatorLine {
        top: 30px;
      }

      .Indicator {
        top: 44px;
      }
    }
  }

  &:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 26px;
    background-color: ${p => p.theme.backgroundSecondary};
    border-bottom: 1px solid ${p => p.theme.border};
  }

  &.Loading {
    .TraceRow {
      .TraceLeftColumnInner {
        width: 100%;
      }
    }

    .TraceRightColumn {
      background-color: transparent !important;
    }

    .TraceDivider {
      pointer-events: none;
    }
  }

  &.Empty {
    .TraceIcon {
      left: 50%;
    }
  }

  .TraceScrollbarContainer {
    left: 0;
    top: 0;
    height: 26px;
    position: absolute;
    overflow-x: auto;
    overscroll-behavior: none;
    will-change: transform;

    .TraceScrollbarScroller {
      height: 1px;
      pointer-events: none;
      visibility: hidden;
    }

    .TraceScrollbarHandle {
      width: 24px;
      height: 12px;
      border-radius: 6px;
    }
  }

  .TraceDivider {
    position: absolute;
    height: 100%;
    background-color: transparent;
    top: 0;
    cursor: ew-resize;
    z-index: 10;

    &:before {
      content: '';
      position: absolute;
      width: 1px;
      height: 100%;
      background-color: ${p => p.theme.border};
      left: 50%;
    }

    &:hover {
      &:before {
        background-color: ${p => p.theme.purple300};
      }
    }
  }

  .TraceIndicatorContainer {
    overflow: hidden;
    width: 100%;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 10;
    pointer-events: none;
  }

  .TraceIndicator {
    z-index: 1;
    width: 3px;
    height: 100%;
    top: 0;
    position: absolute;

    &:hover {
      z-index: 10;
    }

    .TraceIndicatorLabel {
      min-width: 34px;
      text-align: center;
      position: absolute;
      font-size: 10px;
      font-weight: ${p => p.theme.fontWeightBold};
      color: ${p => p.theme.textColor};
      background-color: ${p => p.theme.background};
      border-radius: ${p => p.theme.borderRadius};
      border: 1px solid ${p => p.theme.border};
      padding: 2px;
      display: inline-block;
      line-height: 1;
      margin-top: 2px;
      white-space: nowrap;
    }

    .TraceIndicatorLine {
      width: 1px;
      height: 100%;
      top: 20px;
      position: absolute;
      left: 50%;
      transform: translateX(-2px);
      background: repeating-linear-gradient(
          to bottom,
          transparent 0 4px,
          ${p => p.theme.textColor} 4px 8px
        )
        80%/2px 100% no-repeat;
    }

    .Indicator {
      width: 1px;
      height: 100%;
      position: absolute;
      left: 50%;
      transform: translateX(-2px);
      top: 26px;

      &.CurrentReplayTimestamp {
        background: ${p => p.theme.purple300};
      }

      &.HoverReplayTimestamp {
        background: ${p => p.theme.purple200};
      }
    }

    &.Errored {
      .TraceIndicatorLabel {
        border: 1px solid ${p => p.theme.error};
        color: ${p => p.theme.error};
      }

      .TraceIndicatorLine {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.error} 4px 8px
          )
          80%/2px 100% no-repeat;
      }
    }

    &.Timeline {
      opacity: 1;
      z-index: 1;
      pointer-events: none;

      .TraceIndicatorLabel {
        font-weight: ${p => p.theme.fontWeightNormal};
        min-width: 0;
        top: 8px;
        width: auto;
        border: none;
        background-color: transparent;
        color: ${p => p.theme.subText};
      }

      .TraceIndicatorLine {
        background: ${p => p.theme.translucentGray100};
        top: 8px;
      }
    }
  }

  &.light {
    .TracePattern {
      &.info {
        --pattern-odd: #d1dff9;
        --pattern-even: ${p => p.theme.blue300};
      }
      &.warning {
        --pattern-odd: #a5752c;
        --pattern-even: ${p => p.theme.yellow300};
      }
      &.performance_issue {
        --pattern-odd: #063690;
        --pattern-even: ${p => p.theme.blue300};
      }

      &.profile {
        --pattern-odd: rgba(58, 17, 95, 0.55);
        --pattern-even: transparent;
      }

      &.missing_instrumentation {
        --pattern-odd: #dedae3;
        --pattern-even: #f4f2f7;
      }

      &.error,
      &.fatal {
        --pattern-odd: #872d32;
        --pattern-even: ${p => p.theme.red300};
      }

      /* false positive for grid layout */
      /* stylelint-disable */
      &.default {
      }
      &.unknown {
      }
      /* stylelint-enable */
    }
  }

  &.dark {
    .TracePattern {
      &.info {
        --pattern-odd: #d1dff9;
        --pattern-even: ${p => p.theme.blue300};
      }
      &.warning {
        --pattern-odd: #a5752c;
        --pattern-even: ${p => p.theme.yellow300};
      }
      &.performance_issue {
        --pattern-odd: #063690;
        --pattern-even: ${p => p.theme.blue300};
      }

      &.profile {
        --pattern-odd: rgba(58, 17, 95, 0.55);
        --pattern-even: transparent;
      }

      &.missing_instrumentation {
        --pattern-odd: #4b4550;
        --pattern-even: #1c1521;
      }

      &.error,
      &.fatal {
        --pattern-odd: #510d10;
        --pattern-even: ${p => p.theme.red300};
      }
      /* stylelint-disable */
      &.default {
      }
      &.unknown {
      }
      /* stylelint-enable */
    }
  }

  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    height: 24px;
    width: 100%;
    transition: none;
    font-size: ${p => p.theme.fontSizeSmall};
    transform: translateZ(0);

    --row-background-odd: ${p => p.theme.translucentSurface100};
    --row-background-hover: ${p => p.theme.translucentSurface100};
    --row-background-focused: ${p => p.theme.translucentSurface200};
    --row-outline: ${p => p.theme.blue300};
    --row-children-button-border-color: ${p => p.theme.border};

    /* allow empty blocks so we can keep an exhaustive list of classnames for future reference */
    /* stylelint-disable */
    &.info {
    }
    &.warning {
    }
    &.debug {
    }
    &.error,
    &.fatal,
    &.performance_issue {
      color: ${p => p.theme.errorText};
      --autogrouped: ${p => p.theme.error};
      --row-children-button-border-color: ${p => p.theme.error};
      --row-outline: ${p => p.theme.error};
    }
    &.default {
    }
    &.unknown {
    }

    &.Hidden {
      position: absolute;
      height: 100%;
      width: 100%;
      top: 0;
      z-index: -1;
      &:hover {
        background-color: transparent;
      }
      * {
        cursor: default !important;
      }
    }

    .TraceIcon {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale)) translateZ(0);
      background-color: ${p => p.theme.background};
      width: 18px !important;
      height: 18px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;

      &.info {
        background-color: var(--info);
      }
      &.warning {
        background-color: var(--warning);
      }
      &.debug {
        background-color: var(--debug);
      }
      &.error,
      &.fatal {
        background-color: var(--error);
      }
      &.performance_issue {
        background-color: var(--performance-issue);
      }
      &.default {
        background-color: var(--default);
      }
      &.unknown {
        background-color: var(--unknown);
      }
      &.profile {
        background-color: var(--profile);
      }

      svg {
        width: 12px;
        height: 12px;
        fill: ${p => p.theme.white};
      }

      &.profile svg {
        margin-left: 2px;
      }

      &.info,
      &.warning,
      &.performance_issue,
      &.default,
      &.unknown {
        svg {
          transform: translateY(-1px);
        }
      }
    }

    .TracePatternContainer {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .TracePattern {
      left: 0;
      width: 1000000px;
      height: 100%;
      position: absolute;
      transform-origin: left center;
      transform: scaleX(var(--inverse-span-scale)) translateZ(0);
      background-image: linear-gradient(
        135deg,
        var(--pattern-even) 1%,
        var(--pattern-even) 11%,
        var(--pattern-odd) 11%,
        var(--pattern-odd) 21%,
        var(--pattern-even) 21%,
        var(--pattern-even) 31%,
        var(--pattern-odd) 31%,
        var(--pattern-odd) 41%,
        var(--pattern-even) 41%,
        var(--pattern-even) 51%,
        var(--pattern-odd) 51%,
        var(--pattern-odd) 61%,
        var(--pattern-even) 61%,
        var(--pattern-even) 71%,
        var(--pattern-odd) 71%,
        var(--pattern-odd) 81%,
        var(--pattern-even) 81%,
        var(--pattern-even) 91%,
        var(--pattern-odd) 91%,
        var(--pattern-odd) 101%
      );
      background-size: 25.5px 17px;
    }

    .TracePerformanceIssue {
      position: absolute;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      background-color: var(--performance-issue);
      height: 16px;
    }

    .TraceRightColumn.Odd {
      background-color: var(--row-background-odd);
    }

    &:hover {
      background-color: var(--row-background-hovered);
    }

    &.Highlight {
      box-shadow: inset 0 0 0 1px ${p => p.theme.blue200} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.blue200} !important;
      }
    }

    &.Highlight,
    &:focus,
    &[tabindex='0'] {
      outline: none;
      background-color: var(--row-background-focused);

      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &:focus,
    &[tabindex='0'] {
      background-color: var(--row-background-focused);
      box-shadow: inset 0 0 0 1px var(--row-outline) !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px var(--row-outline) !important;
      }
      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &.SearchResult {
      background-color: ${p => p.theme.yellow100};

      .TraceRightColumn {
        background-color: transparent;
      }
    }

    &.Autogrouped {
      color: ${p => p.theme.blue300};

      .TraceDescription {
        font-weight: ${p => p.theme.fontWeightBold};
      }

      .TraceChildrenCountWrapper {
        button {
          color: ${p => p.theme.white};
          background-color: ${p => p.theme.blue300};
        }
        svg {
          fill: ${p => p.theme.white};
        }
      }

      &.error {
        color: ${p => p.theme.red300};

        .TraceChildrenCountWrapper {
          button {
            color: ${p => p.theme.white};
            background-color: ${p => p.theme.red300};
          }
        }
      }
    }
  }

  .TraceLeftColumn {
    height: 100%;
    white-space: nowrap;
    display: flex;
    align-items: center;
    overflow: hidden;
    will-change: width;
    box-shadow: inset 1px 0 0px 0px transparent;
    cursor: pointer;

    width: calc(var(--list-column-width) * 100%);

    .TraceLeftColumnInner {
      height: 100%;
      white-space: nowrap;
      display: flex;
      align-items: center;
      will-change: transform;
      transform-origin: left center;
      padding-right: ${space(2)};

      img {
        width: 16px;
        height: 16px;
      }
    }
  }

  .TraceRightColumn {
    height: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    will-change: width;
    z-index: 1;
    cursor: pointer;

    width: calc(var(--span-column-width) * 100%);

    &:hover {
      .TraceArrow.Visible {
        opacity: 1;
        transition: 300ms 300ms ease-out;
        pointer-events: auto;
      }
    }
  }

  .TraceBar {
    position: absolute;
    height: 16px;
    width: 100%;
    background-color: black;
    transform-origin: left center;

    &.Invisible {
      background-color: transparent !important;

      > div {
        height: 100%;
      }
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .TraceArrow {
    position: absolute;
    pointer-events: none;
    top: 0;
    width: 14px;
    height: 24px;
    opacity: 0;
    background-color: transparent;
    border: none;
    transition: 60ms ease-out;
    font-size: ${p => p.theme.fontSizeMedium};
    color: ${p => p.theme.subText};
    padding: 0 2px;
    display: flex;
    align-items: center;

    svg {
      fill: ${p => p.theme.subText};
    }

    &.Left {
      left: 0;
    }
    &.Right {
      right: 0;
      transform: rotate(180deg);
    }
  }

  .TraceBarDuration {
    display: inline-block;
    transform-origin: left center;
    font-size: ${p => p.theme.fontSizeExtraSmall};
    color: ${p => p.theme.gray300};
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    position: absolute;
  }

  .TraceChildrenCount {
    height: 16px;
    white-space: nowrap;
    min-width: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 99px;
    padding: 0px 4px;
    transition: all 0.15s ease-in-out;
    background: ${p => p.theme.background};
    border: 1.5px solid var(--row-children-button-border-color);
    line-height: 0;
    z-index: 1;
    font-size: 10px;
    box-shadow: ${p => p.theme.dropShadowLight};
    margin-right: 8px;

    .TraceChildrenCountContent {
      + .TraceChildrenCountAction {
        margin-left: 2px;
      }
    }

    .TraceChildrenCountAction {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .TraceActionsLoadingIndicator {
      margin: 0;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: ${p => p.theme.background};

      animation: show 0.1s ease-in-out forwards;

      @keyframes show {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.86);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .loading-indicator {
        border-width: 2px;
      }

      .loading-message {
        display: none;
      }
    }

    svg {
      width: 7px;
      transition: none;
    }
  }

  .TraceChildrenCountWrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-width: 44px;
    height: 100%;
    position: relative;

    button {
      transition: none;
    }

    svg {
      fill: currentColor;
    }

    &.Orphaned {
      .TraceVerticalConnector,
      .TraceVerticalLastChildConnector,
      .TraceExpandedVerticalConnector {
        border-left: 2px dashed ${p => p.theme.border};
      }

      &::before {
        border-bottom: 2px dashed ${p => p.theme.border};
      }
    }

    &.Root {
      &:before,
      .TraceVerticalLastChildConnector {
        visibility: hidden;
      }
    }

    &::before {
      content: '';
      display: block;
      width: 50%;
      height: 2px;
      border-bottom: 2px solid ${p => p.theme.border};
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }

    &::after {
      content: '';
      background-color: ${p => p.theme.border};
      border-radius: 50%;
      height: 6px;
      width: 6px;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  .TraceVerticalConnector {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: 100%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.border};

    &.Orphaned {
      border-left: 2px dashed ${p => p.theme.border};
    }
  }

  .TraceVerticalLastChildConnector {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: 50%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.border};
    border-bottom-left-radius: 4px;
  }

  .TraceExpandedVerticalConnector {
    position: absolute;
    bottom: 0;
    height: 50%;
    left: 50%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.border};
  }

  .TraceOperation {
    margin-left: 4px;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: ${p => p.theme.fontWeightBold};
  }

  .TraceEmDash {
    margin-left: 4px;
    margin-right: 4px;
  }

  .TraceDescription {
    white-space: nowrap;
  }
`;
