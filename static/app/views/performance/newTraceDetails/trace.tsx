import type React from 'react';
import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {PlatformIcon} from 'platformicons';
import * as qs from 'query-string';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PlatformKey, Project} from 'sentry/types';
import type {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {clamp} from 'sentry/utils/profiling/colors/utils';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {formatTraceDuration} from 'sentry/views/performance/newTraceDetails/formatters';
import {
  useVirtualizedList,
  type VirtualizedRow,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceVirtualizedList';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {
  TraceReducerAction,
  TraceReducerState,
} from 'sentry/views/performance/newTraceDetails/traceState';
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
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isNoDataNode,
  isParentAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './guards';
import {TraceIcons} from './icons';

function decodeScrollQueue(maybePath: unknown): TraceTree.NodePath[] | null {
  if (Array.isArray(maybePath)) {
    return maybePath;
  }

  if (typeof maybePath === 'string') {
    return [maybePath as TraceTree.NodePath];
  }

  return null;
}

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
  scrollQueueRef: React.MutableRefObject<{
    eventId?: string;
    path?: TraceTree.NodePath[];
  } | null>;
  trace: TraceTree;
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_id: string;
  trace_state: TraceReducerState;
}

export function Trace({
  trace,
  trace_id,
  onRowClick,
  manager,
  scrollQueueRef,
  previouslyFocusedNodeRef,
  onTraceSearch,
  onTraceLoad,
  rerender,
  trace_state,
  trace_dispatch,
  forceRerender,
}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rerenderRef = useRef<TraceProps['rerender']>(rerender);
  rerenderRef.current = rerender;

  const treePromiseStatusRef =
    useRef<Map<TraceTreeNode<TraceTree.NodeValue>, 'loading' | 'error' | 'success'>>();

  if (!treePromiseStatusRef.current) {
    treePromiseStatusRef.current = new Map();
  }

  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

  const traceStateRef = useRef<TraceReducerState>(trace_state);
  traceStateRef.current = trace_state;

  if (
    trace.root.space &&
    (trace.root.space[0] !== manager.to_origin ||
      trace.root.space[1] !== manager.trace_space.width)
  ) {
    manager.initializeTraceSpace([trace.root.space[0], 0, trace.root.space[1], 1]);
    const maybeQueue = decodeScrollQueue(qs.parse(location.search).node);
    const maybeEventId = qs.parse(location.search)?.eventId;

    if (maybeQueue || maybeEventId) {
      scrollQueueRef.current = {
        eventId: maybeEventId as string,
        path: maybeQueue as TraceTreeNode<TraceTree.NodeValue>['path'],
      };
    }
  }

  const loadedRef = useRef(false);
  useLayoutEffect(() => {
    if (loadedRef.current) {
      return;
    }
    if (trace.type !== 'trace' || !manager) {
      return;
    }

    loadedRef.current = true;

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
      });
  }, [
    api,
    trace,
    trace_id,
    manager,
    onTraceLoad,
    trace_dispatch,
    scrollQueueRef,
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

        trace_dispatch({
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
    [manager, onNodeExpand, onNodeZoomIn, trace_dispatch]
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
          tabIndex={trace_state.rovingTabIndex.node === n.item ? 0 : -1}
          isSearchResult={trace_state.search.resultsLookup.has(n.item)}
          searchResultsIteratorIndex={trace_state.search.resultIndex}
          style={n.style}
          trace_id={trace_id}
          projects={projectLookup}
          node={n.item}
          manager={manager}
          theme={theme}
          onExpand={onNodeExpand}
          onZoomIn={onNodeZoomIn}
          onRowClick={onRowClick}
          onRowKeyDown={onRowKeyDown}
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
      trace_state.rovingTabIndex.node,
      trace_state.search.resultIteratorIndex,
      trace_state.search.resultsLookup,
      trace_state.search.resultIndex,
      theme,
      trace_id,
      trace.type,
      forceRerender,
    ]
  );

  const render = useMemo(() => {
    return trace.type !== 'trace' || scrollQueueRef.current
      ? r => renderLoadingRow(r)
      : r => renderVirtualizedRow(r);
  }, [renderLoadingRow, renderVirtualizedRow, trace.type, scrollQueueRef]);

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const virtualizedList = useVirtualizedList({
    manager,
    items: trace.list,
    container: scrollContainer,
    render: render,
  });

  return (
    <TraceStylingWrapper
      ref={r => {
        containerRef.current = r;
        manager.registerContainerRef(r);
      }}
      className={`${trace.indicators.length > 0 ? 'WithIndicators' : ''} ${trace.type !== 'trace' || scrollQueueRef.current ? 'Loading' : ''}`}
    >
      <div
        className="TraceScrollbarContainer"
        ref={r => manager.registerHorizontalScrollBarContainerRef(r)}
      >
        <div className="TraceScrollbarScroller" />
      </div>
      <div className="TraceDivider" ref={r => manager.registerDividerRef(r)} />
      <div
        className="TraceIndicatorContainer"
        ref={r => manager.registerIndicatorContainerRef(r)}
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
          const timestamp = manager.to_origin + indicatorTimestamp;

          if (trace.type !== 'trace') {
            return null;
          }

          return (
            <div
              key={i}
              ref={r => manager.registerTimelineIndicatorRef(r, i)}
              className="TraceIndicator Timeline"
              style={{
                transform: `translate(${manager.computeTransformXFromTimestamp(timestamp)}px, 0)`,
              }}
            >
              <div className="TraceIndicatorLabel">
                {indicatorTimestamp > 0
                  ? formatTraceDuration(manager.trace_view.x + indicatorTimestamp)
                  : '0s'}
              </div>
              <div className="TraceIndicatorLine" />
            </div>
          );
        })}
      </div>
      <div
        ref={r => setScrollContainer(r)}
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
  trace_id: string;
}) {
  const virtualized_index = props.index - props.manager.start_virtualized_index;
  const rowSearchClassName = `${props.isSearchResult ? 'SearchResult' : ''} ${props.searchResultsIteratorIndex === props.index ? 'Highlight' : ''}`;

  if (isAutogroupedNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`Autogrouped TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className={`TraceLeftColumnInner`}
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />
              <ChildrenButton
                icon={
                  <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                }
                status={props.node.fetchStatus}
                expanded={!props.node.expanded}
                onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
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
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <AutogroupedTraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            entire_space={props.node.space}
            node_spaces={props.node.autogroupedSegments}
            errors={props.node.errors}
            performance_issues={props.node.performance_issues}
            profiles={props.node.profiles}
          />
          <button
            ref={ref =>
              props.manager.registerArrowRef(ref, props.node.space!, virtualized_index)
            }
            className="TraceArrow"
            onClick={_e => {
              props.manager.onBringRowIntoView(props.node.space!);
            }}
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
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className={`TraceLeftColumnInner`}
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div
              className={
                props.node.isOrphaned
                  ? CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME
                  : CHILDREN_COUNT_WRAPPER_CLASSNAME
              }
            >
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={
                    props.node.canFetch && props.node.fetchStatus === 'idle' ? (
                      '+'
                    ) : props.node.canFetch && props.node.zoomedIn ? (
                      <TraceIcons.Chevron direction="down" />
                    ) : (
                      '+'
                    )
                  }
                  status={props.node.fetchStatus}
                  expanded={props.node.expanded || props.node.zoomedIn}
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
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
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
            ref={ref =>
              props.manager.registerArrowRef(ref, props.node.space!, virtualized_index)
            }
            className="TraceArrow"
            onClick={_e => {
              props.manager.onBringRowIntoView(props.node.space!);
            }}
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
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className={`TraceLeftColumnInner`}
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div
              className={
                props.node.isOrphaned
                  ? CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME
                  : CHILDREN_COUNT_WRAPPER_CLASSNAME
              }
            >
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
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
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
            ref={ref =>
              props.manager.registerArrowRef(ref, props.node.space!, virtualized_index)
            }
            className="TraceArrow"
            onClick={_e => {
              props.manager.onBringRowIntoView(props.node.space!);
            }}
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
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />
            </div>
            <span className="TraceOperation">{t('Missing instrumentation')}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={makeTraceNodeBarColor(props.theme, props.node)}
            node_space={props.node.space}
            performance_issues={NO_PERFORMANCE_ISSUES}
            profiles={NO_PROFILES}
            errors={NO_ERRORS}
          />
          <button
            ref={ref =>
              props.manager.registerArrowRef(ref, props.node.space!, virtualized_index)
            }
            className="TraceArrow"
            onClick={_e => {
              props.manager.onBringRowIntoView(props.node.space!);
            }}
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
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? props.node.max_severity : ''}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            {' '}
            <div className="TraceChildrenCountWrapper Root">
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton icon={''} status={'idle'} expanded onClick={() => void 0}>
                  {props.node.children.length > 0
                    ? COUNT_FORMATTER.format(props.node.children.length)
                    : null}
                </ChildrenButton>
              ) : null}
            </div>
            <span className="TraceOperation">{t('Trace')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.trace_id}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
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
            ref={ref =>
              props.manager.registerArrowRef(ref, props.node.space!, virtualized_index)
            }
            className="TraceArrow"
            onClick={_e => {
              props.manager.onBringRowIntoView(props.node.space!);
            }}
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
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName} ${props.node.max_severity}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
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
            <span className="TraceDescription">{props.node.value.title}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
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

  if (isNoDataNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === 0
            ? maybeFocusRow(r, props.node, props.previouslyFocusedNodeRef)
            : null
        }
        tabIndex={props.tabIndex}
        className={`TraceRow ${rowSearchClassName}`}
        onClick={e => props.onRowClick(props.node, e, props.index)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.manager.registerColumnRef('list', r, virtualized_index, props.node)
          }
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} manager={props.manager} />
            </div>
            <span className="TraceOperation">{t('Empty')}</span>{' '}
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">
              {tct('[type] did not report any span data', {
                type: props.node.parent
                  ? isTransactionNode(props.node.parent)
                    ? 'Transaction'
                    : isSpanNode(props.node.parent)
                      ? 'Span'
                      : ''
                  : '',
              })}
            </span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={
            props.index % 2 === 1
              ? RIGHT_COLUMN_ODD_CLASSNAME
              : RIGHT_COLUMN_EVEN_CLASSNAME
          }
        />
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
        top: props.style.top,
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
  status: TraceTreeNode<any>['fetchStatus'] | undefined;
}) {
  return (
    <button className={`TraceChildrenCount`} onClick={props.onClick}>
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
  if (!props.node_space) {
    return null;
  }

  const duration = formatTraceDuration(props.node_space[1]);
  const spanTransform = props.manager.computeSpanCSSMatrixTransform(props.node_space);

  return (
    <Fragment>
      <div
        ref={r =>
          props.manager.registerSpanBarRef(r, props.node_space!, props.virtualized_index)
        }
        className="TraceBar"
        style={
          {
            transform: `matrix(${spanTransform.join(',')})`,
            '--inverse-span-scale': 1 / spanTransform[0],
            backgroundColor: props.color,
            // unknown css variables cannot be part of the style object
          } as React.CSSProperties
        }
      >
        {props.profiles.length > 0 ? (
          <Profiles
            node_space={props.node_space}
            profiles={props.profiles}
            manager={props.manager}
          />
        ) : null}
        {props.errors.size > 0 ? (
          <Errors
            node_space={props.node_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.size > 0 ? (
          <PerformanceIssues
            manager={props.manager}
            node_space={props.node_space}
            performance_issues={props.performance_issues}
          />
        ) : null}
      </div>
      <div
        ref={r =>
          props.manager.registerSpanBarTextRef(
            r,
            duration,
            props.node_space!,
            props.virtualized_index
          )
        }
        className="TraceBarDuration"
      >
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
  if (!props.node_space || !props.children) {
    return null;
  }

  const spanTransform = `translateX(${props.manager.computeTransformXFromTimestamp(props.node_space[0])}px)`;
  return (
    <div
      ref={r =>
        props.manager.registerInvisibleBarRef(
          r,
          props.node_space!,
          props.virtualizedIndex
        )
      }
      className="TraceBar Invisible"
      style={
        {
          transform: spanTransform,
          // undefined css variables break style rules
          '--inverse-span-scale': 1,
          // unknown css variables cannot be part of the style object
        } as React.CSSProperties
      }
      onDoubleClick={e => {
        e.stopPropagation();
        props.manager.onZoomIntoSpace(props.node_space!);
      }}
    >
      {props.children}
    </div>
  );
}

interface PerformanceIssuesProps {
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
}

function PerformanceIssues(props: PerformanceIssuesProps) {
  const performance_issues = useMemo(() => {
    return [...props.performance_issues];
  }, [props.performance_issues]);

  if (!props.performance_issues.size) {
    return null;
  }

  return (
    <Fragment>
      {performance_issues.map((issue, _i) => {
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

        const max_width = 100 - left;
        const issue_duration = (issue.end - issue.start) * 1e3;
        const width = clamp((issue_duration / props.node_space![1]) * 100, 0, max_width);

        return (
          <div
            key={issue.event_id}
            className="TracePerformanceIssue"
            style={{left: left * 100 + '%', width: width + '%'}}
          >
            <div className={`TraceIcon performance_issue`} style={{left: 0}}>
              <TraceIcons.Icon event={issue} />
            </div>
          </div>
        );
      })}
    </Fragment>
  );
}

interface ErrorsProps {
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
}

function Errors(props: ErrorsProps) {
  const errors = useMemo(() => {
    return [...props.errors];
  }, [props.errors]);

  if (!props.errors.size) {
    return null;
  }

  return (
    <Fragment>
      {errors.map((error, _i) => {
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
            key={error.event_id}
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

interface ProfilesProps {
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  profiles: TraceTree.Profile[];
}

function Profiles(props: ProfilesProps) {
  if (!props.profiles.length) {
    return null;
  }
  return (
    <Fragment>
      {props.profiles.map((profile, _i) => {
        const timestamp = profile.space[0];
        // Clamp the profile timestamp to the span's timestamp
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
            key={profile.profile_id}
            className="TraceIcon profile"
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={profile} />
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

  const duration = formatTraceDuration(props.entire_space[1]);
  const spanTransform = props.manager.computeSpanCSSMatrixTransform(props.entire_space);

  return (
    <Fragment>
      <div
        ref={r =>
          props.manager.registerSpanBarRef(
            r,
            props.entire_space!,
            props.virtualized_index
          )
        }
        className="TraceBar Invisible"
        style={{
          transform: `matrix(${spanTransform.join(',')})`,
          backgroundColor: props.color,
        }}
      >
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
        {props.profiles.length > 0 ? (
          <Profiles
            node_space={props.entire_space}
            profiles={props.profiles}
            manager={props.manager}
          />
        ) : null}
        {props.errors.size > 0 ? (
          <Errors
            node_space={props.entire_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.size > 0 ? (
          <PerformanceIssues
            node_space={props.entire_space}
            performance_issues={props.performance_issues}
            manager={props.manager}
          />
        ) : null}
      </div>
      <div
        ref={r =>
          props.manager.registerSpanBarTextRef(
            r,
            duration,
            props.entire_space!,
            props.virtualized_index
          )
        }
        className="TraceBarDuration"
      >
        {duration}
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
    cursor: col-resize;
    z-index: 10;
    transform: translateX(calc(var(--translate-x) * 1px));

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
    transform: translateX(calc(var(--translate-x) * 1px));
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
      font-weight: bold;
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
        font-weight: normal;
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

  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    height: 24px;
    width: 100%;
    transition: none;
    font-size: ${p => p.theme.fontSizeSmall};

    --row-background-odd: ${p => p.theme.translucentSurface100};
    --row-background-hover: ${p => p.theme.translucentSurface100};
    --row-background-focused: ${p => p.theme.translucentSurface200};
    --row-outline: ${p => p.theme.blue300};
    --row-children-button-border-color: ${p => p.theme.border};

    /* false positive for grid layout */
    /* stylelint-disable */
    &.info {
    }
    &.warning {
    }
    &.error,
    &.fatal,
    &.performance_issue {
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
      transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale));
      background-color: ${p => p.theme.background};
      width: 18px !important;
      height: 18px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      &.info {
        background-color: var(--info);
      }
      &.warning {
        background-color: var(--warning);
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
        font-weight: bold;
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
    border: 2px solid var(--row-children-button-border-color);
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
    font-weight: bold;
  }

  .TraceEmDash {
    margin-left: 4px;
    margin-right: 4px;
  }

  .TraceDescription {
    white-space: nowrap;
  }
`;
