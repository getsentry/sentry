import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {browserHistory} from 'react-router';
import {AutoSizer, List} from 'react-virtualized';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconChevron, IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
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
import type {VirtualizedViewManager} from './virtualizedViewManager';

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
  roving_dispatch: React.Dispatch<RovingTabIndexAction>;
  roving_state: RovingTabIndexState;
  searchResultsIteratorIndex: number | undefined;
  searchResultsMap: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
  search_dispatch: React.Dispatch<TraceSearchAction>;
  search_state: TraceSearchState;
  setDetailNode: (node: TraceTreeNode<TraceTree.NodeValue> | null) => void;
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
  setDetailNode,
  manager,
  searchResultsIteratorIndex,
  searchResultsMap,
  onTraceSearch,
}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const previouslyFocusedIndexRef = useRef<number | null>(null);
  const [_rerender, setRender] = useState(0);

  const scrollQueue = useRef<TraceTree.NodePath[] | null>(null);
  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

  if (
    trace.root.space &&
    (trace.root.space[0] !== manager.to_origin ||
      trace.root.space[1] !== manager.trace_space.width)
  ) {
    manager.initializeTraceSpace([trace.root.space[0], 0, trace.root.space[1], 1]);
    scrollQueue.current = decodeScrollQueue(qs.parse(location.search).node);
  }

  useEffect(() => {
    if (trace.type === 'loading' || scrollQueue.current === null || !manager) {
      return;
    }

    manager
      .scrollToPath(trace, scrollQueue.current, () => setRender(a => (a + 1) % 2), {
        api,
        organization,
      })
      .then(maybeNode => {
        scrollQueue.current = null;

        if (!maybeNode) {
          return;
        }

        manager.onScrollEndOutOfBoundsCheck();
        setDetailNode(maybeNode.node);
        roving_dispatch({
          type: 'set index',
          index: maybeNode.index,
          node: maybeNode.node,
        });

        if (search_state.query) {
          onTraceSearch(search_state.query);
        }
      });
  }, [
    api,
    organization,
    trace,
    trace_id,
    manager,
    search_state.query,
    onTraceSearch,
    setDetailNode,
    roving_dispatch,
  ]);

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
      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...qs.parse(location.search),
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
    [roving_dispatch, setDetailNode, search_state, search_dispatch]
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
        manager.list.scrollToRow(nextIndex);
        roving_dispatch({type: 'set index', index: nextIndex, node});

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
    [manager.list, roving_dispatch, search_state, search_dispatch, trace.list]
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

  const projectLookup = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project>>((acc, project) => {
      acc[project.slug] = project;
      return acc;
    }, {});
  }, [projects]);

  const registerListRef = useCallback(
    (r: List | null) => {
      if (r) {
        manager.registerList(r);
      }
    },
    [manager]
  );

  return (
    <TraceStylingWrapper
      ref={r => manager.onContainerRef(r)}
      className={trace.type === 'loading' ? 'Loading' : ''}
    >
      <TraceDivider className="TraceDivider" ref={r => manager?.registerDividerRef(r)} />
      {trace.type === 'loading' ? <TraceLoading /> : null}
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
      </div>
      <AutoSizer>
        {({width, height}) => (
          <List
            ref={registerListRef}
            rowHeight={24}
            height={height}
            width={width}
            scrollToAlignment="center"
            overscanRowCount={5}
            rowCount={treeRef.current.list.length ?? 0}
            rowRenderer={p => {
              const node = treeRef.current.list[p.index];
              return trace.type === 'loading' ? (
                <RenderPlaceholderRow
                  style={p.style}
                  node={node}
                  index={p.index}
                  theme={theme}
                  projects={projectLookup}
                  manager={manager}
                  startIndex={
                    (p.parent as unknown as {_rowStartIndex: number})._rowStartIndex ?? 0
                  }
                />
              ) : (
                <RenderRow
                  key={p.key}
                  theme={theme}
                  startIndex={
                    (p.parent as unknown as {_rowStartIndex: number})._rowStartIndex ?? 0
                  }
                  overscroll={5}
                  organization={organization}
                  previouslyFocusedIndexRef={previouslyFocusedIndexRef}
                  tabIndex={roving_state.index ?? -1}
                  isSearchResult={searchResultsMap.has(node)}
                  searchResultsIteratorIndex={searchResultsIteratorIndex}
                  index={p.index}
                  style={p.style}
                  trace_id={trace_id}
                  projects={projectLookup}
                  node={node}
                  manager={manager}
                  onExpand={handleExpandNode}
                  onZoomIn={handleZoomIn}
                  onRowClick={onRowClick}
                  onRowKeyDown={onRowKeyDown}
                />
              );
            }}
          />
        )}
      </AutoSizer>
    </TraceStylingWrapper>
  );
}

export default Trace;

const TraceDivider = styled('div')`
  position: absolute;
  height: 100%;
  background-color: transparent;
  top: 0;
  z-index: 10;
  cursor: col-resize;

  &:before {
    content: '';
    position: absolute;
    width: 1px;
    height: 100%;
    background-color: ${p => p.theme.border};
    left: 50%;
  }

  &:hover&:before {
    background-color: ${p => p.theme.purple300};
  }
`;

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
  overscroll: number;
  previouslyFocusedIndexRef: React.MutableRefObject<number | null>;
  projects: Record<Project['slug'], Project>;
  searchResultsIteratorIndex: number | undefined;
  startIndex: number;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string;
}) {
  const virtualizedIndex = props.index - props.startIndex + props.overscroll;
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
        className={`Autogrouped TraceRow ${rowSearchClassName}`}
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
              <ChildrenCountButton
                expanded={!props.node.expanded}
                onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
              >
                {COUNT_FORMATTER.format(props.node.groupCount)}{' '}
              </ChildrenCountButton>
            </div>

            <span className="TraceOperation">{t('Autogrouped')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.node.value.autogrouped_by.op}</span>
          </div>
        </div>
        <div
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          {isParentAutogroupedNode(props.node) ? (
            <TraceBar
              virtualizedIndex={virtualizedIndex}
              manager={props.manager}
              color={props.theme.blue300}
              node_space={props.node.space}
            />
          ) : (
            <SiblingAutogroupedBar
              virtualizedIndex={virtualizedIndex}
              manager={props.manager}
              color={props.theme.blue300}
              node={props.node}
            />
          )}
        </div>
      </div>
    );
  }

  if (isTransactionNode(props.node)) {
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
                >
                  {COUNT_FORMATTER.format(props.node.children.length)}{' '}
                </ChildrenCountButton>
              ) : null}
            </div>
            <ProjectBadge project={props.projects[props.node.value.project_slug]} />
            <span className="TraceOperation">{props.node.value['transaction.op']}</span>
            <strong className="TraceEmDash"> — </strong>
            <span>{props.node.value.transaction}</span>
            {props.node.canFetchData ? (
              <button onClick={e => props.onZoomIn(e, props.node, !props.node.zoomedIn)}>
                {props.node.zoomedIn ? 'spans' : 'span'}
              </button>
            ) : null}
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            manager={props.manager}
            color={pickBarColor(props.node.value['transaction.op'])}
            node_space={props.node.space}
          />
        </div>
      </div>
    );
  }

  if (isSpanNode(props.node)) {
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} manager={props.manager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
                >
                  {COUNT_FORMATTER.format(props.node.children.length)}{' '}
                </ChildrenCountButton>
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
            {props.node.canFetchData ? (
              <button onClick={e => props.onZoomIn(e, props.node, !props.node.zoomedIn)}>
                {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
              </button>
            ) : null}
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            manager={props.manager}
            color={pickBarColor(props.node.value.op)}
            node_space={props.node.space}
          />
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          {' '}
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            manager={props.manager}
            color={pickBarColor('missing-instrumentation')}
            node_space={props.node.space}
          />
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
                >
                  {COUNT_FORMATTER.format(props.node.children.length)}{' '}
                </ChildrenCountButton>
              ) : null}
            </div>

            <span className="TraceOperation">{t('Trace')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.trace_id}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          {' '}
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            manager={props.manager}
            color={pickBarColor('missing-instrumentation')}
            node_space={props.node.space}
          />
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
            props.manager.registerColumnRef('list', r, virtualizedIndex, props.node)
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
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={e => props.onExpand(e, props.node, !props.node.expanded)}
                >
                  {COUNT_FORMATTER.format(props.node.children.length)}{' '}
                </ChildrenCountButton>
              ) : null}
            </div>

            <ProjectBadge project={props.projects[props.node.value.project_slug]} />
            <Link
              className="Errored Link"
              onClick={e => e.stopPropagation()}
              to={generateIssueEventTarget(props.node.value, props.organization)}
            >
              <span className="TraceOperation">{t('Error')}</span>
              <strong className="TraceEmDash"> — </strong>
              <span className="TraceDescription">{props.node.value.title}</span>
            </Link>
          </div>
        </div>
        <div
          ref={r =>
            props.manager.registerColumnRef('span_list', r, virtualizedIndex, props.node)
          }
          className={`TraceRightColumn ${props.index % 2 === 0 ? 0 : 'Odd'}`}
          style={{
            width: props.manager.columns.span_list.width * 100 + '%',
          }}
        >
          {typeof props.node.value.timestamp === 'number' ? (
            <div
              className="ErrorIconBorder"
              style={{
                transform: `translateX(${props.manager.computeTransformXFromTimestamp(
                  props.node.value.timestamp * 1000
                )}px)`,
              }}
            >
              <IconFire color="errorText" size="xs" />
            </div>
          ) : null}
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
  projects: Record<Project['slug'], Project>;
  startIndex: number;
  style: React.CSSProperties;
  theme: Theme;
}) {
  return (
    <div
      className="TraceRow"
      style={{
        top: props.style.top,
        height: props.style.height,
        pointerEvents: 'none',
        color: props.theme.subText,
        paddingLeft: space(1),
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
            {props.node.children.length > 0 ? (
              <ChildrenCountButton
                expanded={props.node.expanded || props.node.zoomedIn}
                onClick={() => void 0}
              >
                {COUNT_FORMATTER.format(props.node.children.length)}{' '}
              </ChildrenCountButton>
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
      {/*
        @TODO count of rendered connectors could be % 3 as we can
        have up to 3 connectors per node, 1 div, 1 before and 1 after
      */}
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

function ProjectBadge(props: {project: Project}) {
  return <ProjectAvatar project={props.project} />;
}

function ChildrenCountButton(props: {
  children: React.ReactNode;
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button className="TraceChildrenCount" onClick={props.onClick}>
      {props.children}
      <IconChevron
        size="xs"
        direction={props.expanded ? 'up' : 'down'}
        style={{marginLeft: 2}}
      />
    </button>
  );
}

interface TraceBarProps {
  color: string;
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  virtualizedIndex: number;
  duration?: number;
}

type SiblingAutogroupedBarProps = Omit<TraceBarProps, 'node_space' | 'duration'> & {
  node: TraceTreeNode<TraceTree.NodeValue>;
};

// Render collapsed representation of sibling autogrouping, using multiple bars for when
// there are gaps between siblings.
function SiblingAutogroupedBar(props: SiblingAutogroupedBarProps) {
  const bars: React.ReactNode[] = [];

  // Start and end represents the earliest start_timestamp and the latest
  // end_timestamp for a set of overlapping siblings.
  let start = isSpanNode(props.node.children[0])
    ? props.node.children[0].value.start_timestamp
    : Number.POSITIVE_INFINITY;

  let end = isSpanNode(props.node.children[0])
    ? props.node.children[0].value.timestamp
    : Number.NEGATIVE_INFINITY;
  let totalDuration = 0;

  for (let i = 0; i < props.node.children.length; i++) {
    const node = props.node.children[i];
    if (!isSpanNode(node)) {
      throw new TypeError('Invalid type of autogrouped child');
    }

    const hasGap = node.value.start_timestamp > end;

    if (!(hasGap || node.isLastChild)) {
      start = Math.min(start, node.value.start_timestamp);
      end = Math.max(end, node.value.timestamp);
      continue;
    }

    // Render a bar for already collapsed set.
    totalDuration += end - start;
    bars.push(
      <TraceBar
        virtualizedIndex={props.virtualizedIndex}
        manager={props.manager}
        color={props.color}
        node_space={[start, end - start]}
        duration={!hasGap ? totalDuration : undefined}
      />
    );

    if (hasGap) {
      // Start a new set.
      start = node.value.start_timestamp;
      end = node.value.timestamp;

      // Render a bar if the sibling with a gap is the last sibling.
      if (node.isLastChild) {
        totalDuration += end - start;
        bars.push(
          <TraceBar
            virtualizedIndex={props.virtualizedIndex}
            manager={props.manager}
            color={props.color}
            duration={totalDuration}
            node_space={[start, end - start]}
          />
        );
      }
    }
  }

  return <Fragment>{bars}</Fragment>;
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
          props.manager.registerSpanBarRef(r, props.node_space!, props.virtualizedIndex)
        }
        className="TraceBar"
        style={{
          transform: `matrix(${spanTransform.join(',')})`,
          backgroundColor: props.color,
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          props.manager.onZoomIntoSpace(props.node_space!);
        }}
      />
      <div
        ref={r =>
          props.manager.registerSpanBarTextRef(
            r,
            duration,
            props.node_space!,
            props.virtualizedIndex
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
  height: 70vh;
  width: 100%;
  margin: auto;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 0 1px ${p => p.theme.border};
  border-radius: ${space(0.5)};
  padding-top: 24px;

  &:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 22px;
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
      padding: ${space(0.25)};
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
  }

  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    width: 100%;
    transition: none;
    font-size: ${p => p.theme.fontSizeSmall};

    .Errored {
      color: ${p => p.theme.error};
    }

    .Link {
      &:hover {
        color: ${p => p.theme.blue300};
      }
    }

    .ErrorIconBorder {
      position: absolute;
      margin: ${space(0.25)};
      left: -12px;
      background: ${p => p.theme.background};
      width: ${space(3)};
      height: ${space(3)};
      border: 1px solid ${p => p.theme.error};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .TraceRightColumn.Odd {
      background-color: ${p => p.theme.backgroundSecondary};
    }

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
    }

    &.Highlight,
    &:focus {
      outline: none;
      background-color: ${p => p.theme.backgroundTertiary};

      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &:focus {
      box-shadow: inset 0 0 0 1px ${p => p.theme.blue300} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.blue300} !important;
      }
    }

    &.Highlight {
      box-shadow: inset 0 0 0 1px ${p => p.theme.blue200} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.blue200} !important;
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
      transform: translateX(var(--column-translate-x));
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
  }

  .TraceBar {
    position: absolute;
    height: 64%;
    width: 100%;
    background-color: black;
    transform-origin: left center;
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
    padding: 0px ${space(0.5)};
    transition: all 0.15s ease-in-out;
    background: ${p => p.theme.background};
    border: 2px solid ${p => p.theme.border};
    line-height: 0;
    z-index: 1;
    font-size: 10px;
    box-shadow: ${p => p.theme.dropShadowLight};
    margin-right: ${space(1)};

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
    margin-left: ${space(0.5)};
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: bold;
  }

  .TraceEmDash {
    margin-left: ${space(0.5)};
    margin-right: ${space(0.5)};
  }

  .TraceDescription {
    white-space: nowrap;
  }
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  position: absolute;
  height: auto;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  z-index: 30;
  padding: 24px;
  background-color: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

function TraceLoading() {
  return (
    <LoadingContainer>
      <NoMarginIndicator size={24}>
        <div>{t('Assembling the trace')}</div>
      </NoMarginIndicator>
    </LoadingContainer>
  );
}

const NoMarginIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
