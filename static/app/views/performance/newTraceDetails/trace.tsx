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
import {browserHistory} from 'react-router';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {PlatformIcon} from 'platformicons';
import * as qs from 'query-string';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization, PlatformKey, Project} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import type {
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {clamp} from 'sentry/utils/profiling/colors/utils';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  getRovingIndexActionFromEvent,
  type RovingTabIndexAction,
  type RovingTabIndexUserActions,
} from 'sentry/views/performance/newTraceDetails/rovingTabIndex';
import type {
  TraceSearchAction,
  TraceSearchState,
} from 'sentry/views/performance/newTraceDetails/traceSearch';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from './guards';
import {ParentAutogroupNode, type TraceTree, type TraceTreeNode} from './traceTree';
import {
  useVirtualizedList,
  type VirtualizedRow,
  type VirtualizedViewManager,
} from './virtualizedViewManager';

function Chevron(props: {direction: 'up' | 'down' | 'left'}) {
  return (
    <svg
      viewBox="0 0 16 16"
      style={{
        transition: 'transform 120ms ease-in-out',
        transform: `rotate(${props.direction === 'up' ? 0 : props.direction === 'down' ? 180 : -90}deg)`,
      }}
    >
      <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
    </svg>
  );
}

function Fire() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M8.08,15.92A6.58,6.58,0,0,1,1.51,9.34a4.88,4.88,0,0,1,2.2-4.25.74.74,0,0,1,1,.34,6,6,0,0,1,4-5.3A.74.74,0,0,1,9.4.22a.73.73,0,0,1,.33.61v.31A15.07,15.07,0,0,0,10,4.93a3.72,3.72,0,0,1,2.3-1.7.74.74,0,0,1,.66.12.75.75,0,0,1,.3.6A6.21,6.21,0,0,0,14,6.79a5.78,5.78,0,0,1,.68,2.55A6.58,6.58,0,0,1,8.08,15.92ZM3.59,7.23A4.25,4.25,0,0,0,3,9.34a5.07,5.07,0,1,0,10.14,0,4.6,4.6,0,0,0-.54-1.94,8,8,0,0,1-.76-2.32A2,2,0,0,0,11.07,7a.75.75,0,0,1-1.32.58C8.4,6,8.25,4.22,8.23,2c-2,1.29-2.15,3.58-2.09,5.85A7.52,7.52,0,0,1,6.14,9a.74.74,0,0,1-.46.63.77.77,0,0,1-.76-.11A4.56,4.56,0,0,1,3.59,7.23Z" />
    </svg>
  );
}

function Profile() {
  return (
    <svg viewBox="0 0 20 16">
      <path d="M15.25,0H.75C.33,0,0,.34,0,.75V5.59c0,.41,.34,.75,.75,.75h1.49v4.09c0,.41,.34,.75,.75,.75h1.73v4.09c0,.41,.34,.75,.75,.75h5.06c.41,0,.75-.34,.75-.75v-4.09h1.73c.41,0,.75-.34,.75-.75V6.34h1.49c.41,0,.75-.34,.75-.75V.75c0-.41-.34-.75-.75-.75Zm-5.47,14.52h-3.56v-3.34h3.56v3.34Zm2.48-4.84H3.74v-3.34H12.25v3.34Zm2.24-4.84H1.5V1.5H14.5v3.34Z" />
    </svg>
  );
}

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
const NO_ERRORS = [];

interface RovingTabIndexState {
  index: number | null;
  items: number | null;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
}

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

function maybeFocusRow(
  ref: HTMLDivElement | null,
  index: number,
  previouslyFocusedIndexRef: React.MutableRefObject<number | null>
) {
  if (!ref) return;
  if (index === previouslyFocusedIndexRef.current) return;

  ref.focus();
  previouslyFocusedIndexRef.current = index;
}

interface TraceProps {
  manager: VirtualizedViewManager;
  onTraceSearch: (query: string) => void;
  previouslyFocusedIndexRef: React.MutableRefObject<number | null>;
  roving_dispatch: React.Dispatch<RovingTabIndexAction>;
  roving_state: RovingTabIndexState;
  scrollQueueRef: React.MutableRefObject<{
    eventId?: string;
    path?: TraceTree.NodePath[];
  } | null>;
  searchResultsIteratorIndex: number | undefined;
  searchResultsMap: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
  search_dispatch: React.Dispatch<TraceSearchAction>;
  search_state: TraceSearchState;
  setClickedNode: (node: TraceTreeNode<TraceTree.NodeValue> | null) => void;
  trace: TraceTree;
  trace_id: string;
}

function Trace({
  trace,
  trace_id,
  roving_state,
  roving_dispatch,
  search_state,
  search_dispatch,
  setClickedNode: setDetailNode,
  manager,
  scrollQueueRef,
  searchResultsIteratorIndex,
  searchResultsMap,
  previouslyFocusedIndexRef,
  onTraceSearch,
}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [_rerender, setRender] = useState(0);

  const treePromiseStatusRef =
    useRef<Map<TraceTreeNode<TraceTree.NodeValue>, 'loading' | 'error' | 'success'>>();

  if (!treePromiseStatusRef.current) {
    treePromiseStatusRef.current = new Map();
  }

  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

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
  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    if (trace.type !== 'trace' || !manager) {
      return;
    }

    loadedRef.current = true;

    if (!scrollQueueRef.current) {
      if (search_state.query) {
        onTraceSearch(search_state.query);
      }
      return;
    }

    // Node path has higher specificity than eventId
    const promise = scrollQueueRef.current?.path
      ? manager.scrollToPath(
          trace,
          scrollQueueRef.current.path,
          () => setRender(a => (a + 1) % 2),
          {
            api,
            organization,
          }
        )
      : scrollQueueRef.current.eventId
        ? manager.scrollToEventID(
            scrollQueueRef?.current?.eventId,
            trace,
            () => setRender(a => (a + 1) % 2),
            {
              api,
              organization,
            }
          )
        : Promise.resolve(null);

    promise.then(maybeNode => {
      // Important to set scrollQueueRef.current to null and trigger a rerender
      // after the promise resolves as we show a loading state during scroll,
      // else the screen could jump around while we fetch span data
      scrollQueueRef.current = null;

      if (!maybeNode) {
        Sentry.captureMessage('Failled to find and scroll to node in tree');
        return;
      }

      if (maybeNode.node.space) {
        manager.animateViewTo(maybeNode.node.space);
      }

      manager.onScrollEndOutOfBoundsCheck();
      setDetailNode(maybeNode.node);
      roving_dispatch({
        type: 'set index',
        index: maybeNode.index,
        node: maybeNode.node,
      });

      manager.list?.scrollToRow(maybeNode.index, 'top');
      manager.scrollRowIntoViewHorizontally(maybeNode.node, 0);

      if (search_state.query) {
        onTraceSearch(search_state.query);
      }
    });
  }, [
    api,
    scrollQueueRef,
    organization,
    trace,
    trace_id,
    manager,
    search_state.query,
    onTraceSearch,
    setDetailNode,
    roving_dispatch,
  ]);

  const previousSearchResultIndexRef = useRef<number | undefined>(
    search_state.resultIndex
  );
  useLayoutEffect(() => {
    if (previousSearchResultIndexRef.current === search_state.resultIndex) {
      return;
    }
    if (!manager.list) {
      return;
    }

    if (typeof search_state.resultIndex !== 'number') {
      return;
    }

    manager.scrollToRow(search_state.resultIndex);

    if (previousSearchResultIndexRef.current === undefined) {
      return;
    }

    const previousNode = treeRef.current.list[previousSearchResultIndexRef.current!];
    previousSearchResultIndexRef.current = search_state.resultIndex;

    if (previousNode) {
      const nextNode = treeRef.current.list[search_state.resultIndex];
      const offset =
        nextNode.depth >= previousNode.depth ? manager.trace_physical_space.width / 2 : 0;

      if (
        manager.isOutsideOfViewOnKeyDown(
          treeRef.current.list[search_state.resultIndex],
          offset
        )
      ) {
        manager.scrollRowIntoViewHorizontally(
          treeRef.current.list[search_state.resultIndex],
          0,
          offset
        );
      }
    }
  }, [search_state.resultIndex, manager]);

  const handleZoomIn = useCallback(
    (
      event: React.MouseEvent,
      node: TraceTreeNode<TraceTree.NodeValue>,
      value: boolean
    ) => {
      if (!isTransactionNode(node) && !isSpanNode(node)) {
        throw new TypeError('Node must be a transaction or span');
      }

      event.stopPropagation();
      setRender(a => (a + 1) % 2);

      treeRef.current
        .zoomIn(node, value, {
          api,
          organization,
        })
        .then(() => {
          setRender(a => (a + 1) % 2);
          if (search_state.query) {
            onTraceSearch(search_state.query);
          }

          if (search_state.resultsLookup.has(node)) {
            const idx = search_state.resultsLookup.get(node)!;

            search_dispatch({
              type: 'set iterator index',
              resultIndex: search_state.results?.[idx]?.index!,
              resultIteratorIndex: idx,
            });
          } else {
            search_dispatch({type: 'clear iterator index'});
          }
          treePromiseStatusRef.current!.set(node, 'success');
        })
        .catch(_e => {
          treePromiseStatusRef.current!.set(node, 'error');
        });
    },
    [api, organization, search_state, search_dispatch, onTraceSearch]
  );

  const handleExpandNode = useCallback(
    (
      event: React.MouseEvent<Element>,
      node: TraceTreeNode<TraceTree.NodeValue>,
      value: boolean
    ) => {
      event.stopPropagation();

      treeRef.current.expand(node, value);
      setRender(a => (a + 1) % 2);

      if (search_state.query) {
        onTraceSearch(search_state.query);
      }

      if (search_state.resultsLookup.has(node)) {
        const idx = search_state.resultsLookup.get(node)!;

        search_dispatch({
          type: 'set iterator index',
          resultIndex: search_state.results?.[idx]?.index!,
          resultIteratorIndex: idx,
        });
      } else {
        search_dispatch({type: 'clear iterator index'});
      }
    },
    [search_state, search_dispatch, onTraceSearch]
  );

  const onRowClick = useCallback(
    (
      _event: React.MouseEvent,
      index: number,
      node: TraceTreeNode<TraceTree.NodeValue>
    ) => {
      previousSearchResultIndexRef.current = index;
      previouslyFocusedIndexRef.current = index;
      const {eventId: _eventId, ...query} = qs.parse(location.search);
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...query,
          node: node.path,
        },
      });
      setDetailNode(node);
      roving_dispatch({type: 'set index', index, node});

      if (search_state.resultsLookup.has(node)) {
        const idx = search_state.resultsLookup.get(node)!;

        search_dispatch({
          type: 'set iterator index',
          resultIndex: index,
          resultIteratorIndex: idx,
        });
      } else {
        search_dispatch({type: 'clear iterator index'});
      }
    },
    [
      roving_dispatch,
      setDetailNode,
      search_state,
      search_dispatch,
      previouslyFocusedIndexRef,
      previousSearchResultIndexRef,
    ]
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
      const action = getRovingIndexActionFromEvent(event);
      if (action) {
        event.preventDefault();
        const nextIndex = computeNextIndexFromAction(
          index,
          action,
          treeRef.current.list.length - 1
        );
        manager.scrollToRow(nextIndex);
        roving_dispatch({type: 'set index', index: nextIndex, node});

        const nextNode = treeRef.current.list[nextIndex];
        const offset =
          nextNode.depth >= node.depth ? manager.trace_physical_space.width / 2 : 0;

        if (manager.isOutsideOfViewOnKeyDown(trace.list[nextIndex], offset)) {
          manager.scrollRowIntoViewHorizontally(trace.list[nextIndex], 0, offset);
        }

        if (search_state.resultsLookup.has(trace.list[nextIndex])) {
          const idx = search_state.resultsLookup.get(trace.list[nextIndex])!;

          search_dispatch({
            type: 'set iterator index',
            resultIndex: nextIndex,
            resultIteratorIndex: idx,
          });
        } else {
          search_dispatch({type: 'clear iterator index'});
        }
      }
    },
    [manager, roving_dispatch, search_state, search_dispatch, trace.list]
  );

  // @TODO this is the implementation of infinite scroll. Once the user
  // reaches the end of the list, we fetch more data. The data is not yet
  // being appended to the tree as we need to figure out UX for this.
  // onRowsRendered callback should be passed to the List component

  // const limitRef = useRef<number | null>(null);
  // if (limitRef.current === null) {
  //   let decodedLimit = getTraceQueryParams(qs.parse(location.search)).limit;
  //   if (typeof decodedLimit === 'string') {
  //     decodedLimit = parseInt(decodedLimit, 2);
  //   }

  //   limitRef.current = decodedLimit;
  // }

  // const loadMoreRequestRef =
  //   useRef<Promise<TraceSplitResults<TraceFullDetailed> | null> | null>(null);

  // const onRowsRendered = useCallback((rows: RenderedRows) => {
  //   if (loadMoreRequestRef.current) {
  //     // in flight request
  //     return;
  //   }
  //   if (rows.stopIndex !== treeRef.current.list.length - 1) {
  //     // not at the end
  //     return;
  //   }
  //   if (
  //     !loadMoreRequestRef.current &&
  //     limitRef.current &&
  //     rows.stopIndex === treeRef.current.list.length - 1
  //   ) {
  //     limitRef.current = limitRef.current + 500;
  //     const promise = fetchTrace(api, {
  //       traceId: trace_id,
  //       orgSlug: organization.slug,
  //       query: qs.stringify(getTraceQueryParams(location, {limit: limitRef.current})),
  //     })
  //       .then(data => {
  //         return data;
  //       })
  //       .catch(e => {
  //         return e;
  //       });

  //     loadMoreRequestRef.current = promise;
  //   }
  // }, []);

  const projectLookup: Record<string, PlatformKey | undefined> = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project['platform']>>(
      (acc, project) => {
        acc[project.slug] = project.platform;
        return acc;
      },
      {}
    );
  }, [projects]);

  const render = useCallback(
    (n: VirtualizedRow) => {
      return trace.type !== 'trace' || scrollQueueRef.current ? (
        <RenderPlaceholderRow
          key={n.key}
          index={n.index}
          style={n.style}
          node={n.item}
          theme={theme}
          projects={projectLookup}
          manager={manager}
        />
      ) : (
        <RenderRow
          key={n.key}
          index={n.index}
          organization={organization}
          previouslyFocusedIndexRef={previouslyFocusedIndexRef}
          tabIndex={roving_state.index ?? -1}
          isSearchResult={searchResultsMap.has(n.item)}
          searchResultsIteratorIndex={searchResultsIteratorIndex}
          style={n.style}
          trace_id={trace_id}
          projects={projectLookup}
          node={n.item}
          manager={manager}
          theme={theme}
          onExpand={handleExpandNode}
          onZoomIn={handleZoomIn}
          onRowClick={onRowClick}
          onRowKeyDown={onRowKeyDown}
        />
      );
    },
    // we add _rerender as a dependency to trigger the virtualized list rerender
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      handleExpandNode,
      handleZoomIn,
      manager,
      onRowClick,
      onRowKeyDown,
      organization,
      projectLookup,
      roving_state.index,
      searchResultsIteratorIndex,
      searchResultsMap,
      theme,
      trace_id,
      trace.type,
      _rerender,
    ]
  );

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const virtualizedList = useVirtualizedList({
    manager,
    items: trace.list,
    container: scrollContainer,
    render,
  });

  return (
    <TraceStylingWrapper
      ref={r => {
        containerRef.current = r;
        manager.onContainerRef(r);
      }}
      className={`${trace.indicators.length > 0 ? 'WithIndicators' : ''} ${trace.type !== 'trace' || scrollQueueRef.current ? 'Loading' : ''}`}
    >
      <div className="TraceDivider" ref={r => manager?.registerDividerRef(r)} />
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
                  className="TraceIndicator"
                >
                  <div className="TraceIndicatorLabel">{indicator.label}</div>
                  <div className="TraceIndicatorLine" />
                </div>
              );
            })
          : null}

        {manager.interval_bars.map((_, i) => {
          const indicatorTimestamp = manager.intervals[i];
          const timestamp = manager.to_origin + indicatorTimestamp ?? 0;

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
                  ? getDuration(
                      (manager.trace_view.x + indicatorTimestamp) / 1000,
                      2,
                      true
                    )
                  : '0s'}
              </div>
              <div className="TraceIndicatorLine" />
            </div>
          );
        })}
      </div>
      <div ref={r => setScrollContainer(r)}>
        <div>{virtualizedList.rendered}</div>
      </div>
    </TraceStylingWrapper>
  );
}

export default Trace;

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
    event: React.MouseEvent<Element>,
    index: number,
    node: TraceTreeNode<TraceTree.NodeValue>
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
  previouslyFocusedIndexRef: React.MutableRefObject<number | null>;
  projects: Record<Project['slug'], Project['platform']>;
  searchResultsIteratorIndex: number | undefined;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string;
}) {
  const virtualized_index = props.index - props.manager.start_virtualized_index;
  if (!props.node.value) {
    return null;
  }

  const rowSearchClassName = `${props.isSearchResult ? 'SearchResult' : ''} ${props.searchResultsIteratorIndex === props.index ? 'Highlight' : ''}`;

  if (isAutogroupedNode(props.node)) {
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`Autogrouped TraceRow ${rowSearchClassName} ${props.node.has_errors ? 'Errored' : ''}`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
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
                  props.node.expanded ? (
                    <Chevron direction="up" />
                  ) : (
                    <Chevron direction="down" />
                  )
                }
                status={props.node.fetchStatus}
                expanded={!props.node.expanded}
                onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
                errored={props.node.has_errors}
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
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <AutogroupedTraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={props.theme.blue300}
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
            <Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isTransactionNode(props.node)) {
    const errored =
      props.node.value.errors.length > 0 ||
      props.node.value.performance_issues.length > 0;

    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`TraceRow ${rowSearchClassName} ${errored ? 'Errored' : ''}`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className={`TraceLeftColumnInner`}
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }
              `}
            >
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={
                    props.node.canFetch && props.node.fetchStatus === 'idle' ? (
                      '+'
                    ) : props.node.canFetch && props.node.zoomedIn ? (
                      <Chevron direction="down" />
                    ) : (
                      '+'
                    )
                  }
                  status={props.node.fetchStatus}
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e =>
                    props.node.canFetch
                      ? props.onZoomIn(e, props.node, !props.node.zoomedIn)
                      : props.onExpand(e, props.node, !props.node.expanded)
                  }
                  errored={errored}
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
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={pickBarColor(props.node.value['transaction.op'])}
            node_space={props.node.space}
            errors={props.node.value.errors}
            performance_issues={props.node.value.performance_issues}
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
            <Chevron direction="left" />
          </button>
        </div>
      </div>
    );
  }

  if (isSpanNode(props.node)) {
    const errored =
      props.node.errors.length > 0 || props.node.performance_issues.length > 0;
    return (
      <div
        key={props.index}
        ref={r =>
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`TraceRow ${rowSearchClassName} ${errored ? 'Errored' : ''}`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className={`TraceLeftColumnInner`}
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 || props.node.canFetch ? (
                <ChildrenButton
                  icon={
                    props.node.canFetch ? (
                      '+'
                    ) : props.node.expanded ? (
                      <Chevron direction="up" />
                    ) : (
                      <Chevron direction="down" />
                    )
                  }
                  status={props.node.fetchStatus}
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e =>
                    props.node.canFetch
                      ? props.onZoomIn(e, props.node, !props.node.zoomedIn)
                      : props.onExpand(e, props.node, !props.node.expanded)
                  }
                  errored={errored}
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
                ? 'unknown'
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
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={pickBarColor(props.node.value.op)}
            node_space={props.node.space}
            errors={props.node.errors}
            performance_issues={props.node.performance_issues}
            profiles={NO_ERRORS}
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
            <Chevron direction="left" />
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
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`TraceRow ${rowSearchClassName}`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
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
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={props.theme.gray300}
            node_space={props.node.space}
            performance_issues={NO_ERRORS}
            profiles={NO_ERRORS}
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
            <Chevron direction="left" />
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
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`TraceRow ${rowSearchClassName} ${props.node.has_errors ? 'Errored' : ''}`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.manager.row_depth_padding,
            }}
          >
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
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            props.manager.onZoomIntoSpace(props.node.space!);
          }}
        >
          <TraceBar
            virtualized_index={virtualized_index}
            manager={props.manager}
            color={pickBarColor('missing-instrumentation')}
            node_space={props.node.space}
            errors={NO_ERRORS}
            performance_issues={NO_ERRORS}
            profiles={NO_ERRORS}
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
            <Chevron direction="left" />
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
          props.tabIndex === props.index
            ? maybeFocusRow(r, props.index, props.previouslyFocusedIndexRef)
            : null
        }
        tabIndex={props.tabIndex === props.index ? 0 : -1}
        className={`TraceRow ${rowSearchClassName} Errored`}
        onClick={e => props.onRowClick(e, props.index, props.node)}
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
          style={{
            width: props.manager.columns.list.width * 100 + '%',
          }}
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
            <PlatformIcon
              platform={props.projects[props.node.value.project_slug] ?? 'default'}
            />
            <span className="TraceOperation">{t('Error')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.node.value.title}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualized_index, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
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
              <div className="TraceError">
                <Fire />
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
  projects: Record<Project['slug'], Project['platform']>;
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
        className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
        style={{
          width: props.manager.columns.span_list.width * 100 + '%',
          backgroundColor:
            props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
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
  const showVerticalConnector =
    ((props.node.expanded || props.node.zoomedIn) && props.node.children.length > 0) ||
    (props.node.value && isParentAutogroupedNode(props.node));

  // If the tail node of the collapsed node has no children,
  // we don't want to render the vertical connector as no children
  // are being rendered as the chain is entirely collapsed
  const hideVerticalConnector =
    showVerticalConnector &&
    props.node.value &&
    props.node instanceof ParentAutogroupNode &&
    !props.node.tail.children.length;

  return (
    <Fragment>
      {props.node.connectors.map((c, i) => {
        return (
          <div
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
        <div className="TraceExpandedVerticalConnector" />
      ) : null}
      {props.node.isLastChild ? (
        <div className="TraceVerticalLastChildConnector" />
      ) : (
        <div className="TraceVerticalConnector" />
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
  errored?: boolean;
}) {
  return (
    <button
      className={`TraceChildrenCount ${props.errored ? 'Errored' : ''}`}
      onClick={props.onClick}
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
  errors: TraceTreeNode<TraceTree.Transaction>['value']['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['value']['performance_issues'];
  profiles: TraceTreeNode<TraceTree.NodeValue>['profiles'];
  virtualized_index: number;
}

function TraceBar(props: TraceBarProps) {
  if (!props.node_space) {
    return null;
  }

  const duration = getDuration(props.node_space[1] / 1000, 2, true);
  const spanTransform = props.manager.computeSpanCSSMatrixTransform(props.node_space);
  const [inside, textTransform] = props.manager.computeSpanTextPlacement(
    props.node_space,
    duration
  );

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
        {props.errors.length > 0 ? (
          <Errors
            node_space={props.node_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.length > 0 ? (
          <PerformanceIssues
            node_space={props.node_space}
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
            props.node_space!,
            props.virtualized_index
          )
        }
        className="TraceBarDuration"
        style={{
          color: inside ? 'white' : '',
          transform: `translate(${textTransform ?? 0}px, 0)`,
        }}
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

  const transform = `translateX(${props.manager.computeTransformXFromTimestamp(props.node_space[0])}px)`;
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
      style={{
        transform,
      }}
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
  performance_issues: TracePerformanceIssue[];
}

function PerformanceIssues(props: PerformanceIssuesProps) {
  return (
    <Fragment>
      {props.performance_issues.map((issue, _i) => {
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
            <div className="TraceError" style={{left: 0}}>
              <Fire />
            </div>
          </div>
        );
      })}
    </Fragment>
  );
}

interface ErrorsProps {
  errors: TraceError[];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
}

function Errors(props: ErrorsProps) {
  if (!props.errors.length) {
    return null;
  }

  return (
    <Fragment>
      {props.errors.map((error, _i) => {
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
            className="TraceError"
            style={{left: left * 100 + '%'}}
          >
            <Fire />
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
            className="TraceProfile"
            style={{left: left * 100 + '%'}}
          >
            <Profile />
          </div>
        );
      })}
    </Fragment>
  );
}

interface AutogroupedTraceBarProps {
  color: string;
  entire_space: [number, number] | null;
  errors: TraceTreeNode<TraceTree.Transaction>['value']['errors'];
  manager: VirtualizedViewManager;
  node_spaces: [number, number][];
  performance_issues: TraceTreeNode<TraceTree.Transaction>['value']['performance_issues'];
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

  const duration = getDuration(props.entire_space[1] / 1000, 2, true);
  const spanTransform = props.manager.computeSpanCSSMatrixTransform(props.entire_space);
  const [inside, textTransform] = props.manager.computeSpanTextPlacement(
    props.entire_space,
    duration
  );

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
                left: `${left * 1000}%`,
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
        {props.errors.length > 0 ? (
          <Errors
            node_space={props.entire_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.performance_issues.length > 0 ? (
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
        style={{
          color: inside ? 'white' : '',
          transform: `translate(${textTransform ?? 0}px, 0)`,
        }}
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

  .TraceDivider {
    position: absolute;
    height: 100%;
    background-color: transparent;
    top: 0;
    cursor: col-resize;
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
  }

  .TraceIndicator {
    z-index: 1;
    width: 3px;
    height: 100%;
    top: 0;
    position: absolute;

    .TraceIndicatorLabel {
      min-width: 34px;
      text-align: center;
      position: absolute;
      font-size: ${p => p.theme.fontSizeExtraSmall};
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

    .TraceError {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale));
      background: ${p => p.theme.background};
      width: 18px !important;
      height: 18px !important;
      background-color: ${p => p.theme.error};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        fill: ${p => p.theme.white};
      }
    }

    .TraceProfile {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale));
      background: ${p => p.theme.background};
      width: 18px !important;
      height: 18px !important;
      background-color: ${p => p.theme.purple300};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        fill: ${p => p.theme.white};
      }
    }

    .TracePerformanceIssue {
      position: absolute;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      background-color: ${p => p.theme.error};
      height: 16px;
    }

    .TraceRightColumn.Odd {
      background-color: ${p => p.theme.backgroundSecondary};
    }

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
    }

    &.Highlight {
      box-shadow: inset 0 0 0 1px ${p => p.theme.blue200} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.blue200} !important;
      }
    }

    &.Highlight,
    &:focus {
      outline: none;
      background-color: ${p => p.theme.backgroundTertiary};

      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &:focus,
    &[tabindex='0'] {
      background-color: ${p => p.theme.backgroundTertiary};
      box-shadow: inset 0 0 0 1px ${p => p.theme.blue300} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.blue300} !important;
      }
      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &.Errored {
      color: ${p => p.theme.error};

      .TraceChildrenCount {
        border: 2px solid ${p => p.theme.error};
      }

      &:focus,
      &[tabindex='0'] {
        box-shadow: inset 0 0 0 1px ${p => p.theme.red300} !important;

        .TraceLeftColumn {
          box-shadow: inset 0px 0 0px 1px ${p => p.theme.red300} !important;
        }
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

      &.Errored {
        .TraceChildrenCount {
          background-color: ${p => p.theme.error} !important;
        }
      }

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

    .TraceLeftColumnInner {
      height: 100%;
      white-space: nowrap;
      display: flex;
      align-items: center;
      will-change: transform;
      transform-origin: left center;

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

      .TraceError {
        top: -1px;
        transform: translate(-50%, 0);
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
    transition: color 0.1s ease-in-out;
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
    border: 2px solid ${p => p.theme.border};
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
