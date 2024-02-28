import type React from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {browserHistory} from 'react-router';
import {AutoSizer, List} from 'react-virtualized';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

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
import {VirtualizedViewManager} from './virtualizedViewManager';

function decodeScrollQueue(maybePath: unknown): TraceTree.NodePath[] | null {
  if (Array.isArray(maybePath)) {
    return maybePath;
  }

  if (typeof maybePath === 'string') {
    return [maybePath as TraceTree.NodePath];
  }

  return null;
}

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

type RovingTabIndexAction =
  | {
      index: number | null;
      items: number;
      node: TraceTreeNode<TraceTree.NodeValue> | null;
      type: 'initialize';
    }
  | {index: number; node: TraceTreeNode<TraceTree.NodeValue>; type: 'go to index'}
  | {index: number; node: TraceTreeNode<TraceTree.NodeValue>; type: 'set node'};

type RovingTabIndexUserActions = 'next' | 'previous' | 'last' | 'first';

function rovingTabIndexReducer(
  state: RovingTabIndexState,
  action: RovingTabIndexAction
): RovingTabIndexState {
  switch (action.type) {
    case 'initialize': {
      return {index: action.index, items: action.items, node: action.node};
    }
    case 'go to index':
      return {...state, index: action.index};
    case 'set node': {
      return {...state, node: action.node, index: action.index};
    }
    default:
      throw new Error('Invalid action');
  }
}

function getRovingIndexActionFromEvent(
  event: React.KeyboardEvent
): RovingTabIndexUserActions | null {
  // @TODO it would be trivial to extend this and support
  // things like j/k vim-like navigation or add modifiers
  // so that users could jump to parent or sibling nodes.
  // I would need to put some thought into this, but shift+cmd+up
  // seems like a good candidate for jumping to parent node and
  // shift+cmd+down for jumping to the next sibling node.
  switch (event.key) {
    case 'ArrowDown':
      if (event.shiftKey) {
        return 'last';
      }
      return 'next';
    case 'ArrowUp':
      if (event.shiftKey) {
        return 'first';
      }
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Tab':
      if (event.shiftKey) {
        return 'previous';
      }
      return 'next';

    default:
      return null;
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
  trace: TraceTree;
  trace_id: string;
}

function Trace({trace, trace_id}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const viewManager = useMemo(() => {
    return new VirtualizedViewManager({
      list: {width: 0.5},
      span_list: {width: 0.5},
    });
  }, []);

  const [state, dispatch] = useReducer(rovingTabIndexReducer, {
    index: null,
    items: null,
    node: null,
  });

  useLayoutEffect(() => {
    return dispatch({
      type: 'initialize',
      items: trace.list.length - 1,
      index: null,
      node: null,
    });
  }, [trace.list.length]);

  const previouslyFocusedIndexRef = useRef<number | null>(null);

  const [_rerender, setRender] = useState(0);

  const scrollQueue = useRef<TraceTree.NodePath[] | null>(null);
  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

  if (
    trace.root.space &&
    (trace.root.space[0] !== viewManager.to_origin ||
      trace.root.space[1] !== viewManager.trace_space.width)
  ) {
    viewManager.initializeTraceSpace([trace.root.space[0], 0, trace.root.space[1], 1]);
    scrollQueue.current = decodeScrollQueue(qs.parse(location.search).node);
  }

  useEffect(() => {
    if (trace.type === 'loading' || scrollQueue.current === null || !viewManager) {
      return;
    }

    viewManager
      .scrollToPath(trace, scrollQueue.current, () => setRender(a => (a + 1) % 2), {
        api,
        organization,
      })
      .then(maybeNode => {
        scrollQueue.current = null;

        if (!maybeNode) {
          return;
        }

        viewManager.current?.onScrollEndOutOfBoundsCheck();
        dispatch({type: 'set node', index: maybeNode.index, node: maybeNode.node});
      });
  }, [api, organization, trace, trace_id, viewManager]);

  const handleFetchChildren = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => {
      if (!isTransactionNode(node) && !isSpanNode(node)) {
        throw new TypeError('Node must be a transaction or span');
      }

      treeRef.current
        .zoomIn(node, value, {
          api,
          organization,
        })
        .then(() => {
          setRender(a => (a + 1) % 2);
        });
    },
    [api, organization]
  );

  const handleExpandNode = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => {
      treeRef.current.expand(node, value);
      setRender(a => (a + 1) % 2);
    },
    []
  );

  const onRowClick = useCallback((node: TraceTreeNode<TraceTree.NodeValue>) => {
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...qs.parse(location.search),
        node: node.path,
      },
    });
    dispatch({type: 'go to index', index, node});
  }, []);

  const onRowKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      index: number,
      node: TraceTreeNode<TraceTree.NodeValue>
    ) => {
      if (!viewManager.current?.list) {
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
        viewManager.current.list.scrollToRow(nextIndex);
        dispatch({type: 'go to index', index: nextIndex, node});
      }
    },
    []
  );

  const projectLookup = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project>>((acc, project) => {
      acc[project.slug] = project;
      return acc;
    }, {});
  }, [projects]);

  return (
    <Fragment>
      <TraceStylingWrapper
        ref={r => viewManager.onContainerRef(r)}
        className={trace.type === 'loading' ? 'Loading' : ''}
        style={{
          height: '70vh',
          width: '100%',
          margin: 'auto',
        }}
      >
        <TraceDivider
          className="TraceDivider"
          ref={r => viewManager?.registerDividerRef(r)}
        />
        {trace.type === 'loading' ? <TraceLoading /> : null}
        <AutoSizer>
          {({width, height}) => (
            <Fragment>
              {trace.indicators.length > 0
                ? trace.indicators.map((indicator, i) => {
                    return (
                      <div
                        key={i}
                        ref={r => viewManager.registerIndicatorRef(r, i, indicator)}
                        className="TraceIndicator"
                      >
                        <div className="TraceIndicatorLine" />
                      </div>
                    );
                  })
                : null}
              <List
                ref={r => viewManager.registerList(r)}
                rowHeight={24}
                height={height}
                width={width}
                scrollToAlignment="center"
                overscanRowCount={5}
                rowCount={treeRef.current.list.length ?? 0}
                rowRenderer={p => {
                  return trace.type === 'loading' ? (
                    <RenderPlaceholderRow
                      style={p.style}
                      node={treeRef.current.list[p.index]}
                      index={p.index}
                      theme={theme}
                      projects={projectLookup}
                      viewManager={viewManager!}
                      startIndex={
                        (p.parent as unknown as {_rowStartIndex: number})
                          ._rowStartIndex ?? 0
                      }
                    />
                  ) : (
                    <RenderRow
                      key={p.key}
                      theme={theme}
                      startIndex={
                        (p.parent as unknown as {_rowStartIndex: number})
                          ._rowStartIndex ?? 0
                      }
                      previouslyFocusedIndexRef={previouslyFocusedIndexRef}
                      tabIndex={state.index ?? -1}
                      index={p.index}
                      style={p.style}
                      trace_id={trace_id}
                      projects={projectLookup}
                      node={treeRef.current.list[p.index]}
                      viewManager={viewManager!}
                      clickedNode={clickedNode}
                      onFetchChildren={handleFetchChildren}
                      onExpandNode={handleExpandNode}
                      onRowClick={onRowClick}
                      onRowKeyDown={onRowKeyDown}
                    />
                  );
                }}
              />
            </Fragment>
          )}
        </AutoSizer>
      </TraceStylingWrapper>
    </Fragment>
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
  node: TraceTreeNode<TraceTree.NodeValue>;
  onExpandNode: (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => void;
  onFetchChildren: (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => void;
  onRowClick: (index: number, node: TraceTreeNode<TraceTree.NodeValue>) => void;
  onRowKeyDown: (
    event: React.KeyboardEvent,
    index: number,
    node: TraceTreeNode<TraceTree.NodeValue>
  ) => void;
  previouslyFocusedIndexRef: React.MutableRefObject<number | null>;
  projects: Record<Project['slug'], Project>;
  startIndex: number;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string;
  viewManager: VirtualizedViewManager;
}) {
  const virtualizedIndex = props.index - props.startIndex;
  if (!props.node.value) {
    return null;
  }

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
        className="TraceRow Autogrouped"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} viewManager={props.viewManager} />
              <ChildrenCountButton
                expanded={!props.node.expanded}
                onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
              >
                {props.node.groupCount}{' '}
              </ChildrenCountButton>
            </div>

            <span className="TraceOperation">{t('Autogrouped')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.node.value.autogrouped_by.op}</span>
          </div>
        </div>
        <div
          className="TraceRightColumn"
          ref={r =>
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          {isParentAutogroupedNode(props.node) ? (
            <TraceBar
              virtualizedIndex={virtualizedIndex}
              viewManager={props.viewManager}
              color={props.theme.blue300}
              node_space={props.node.space}
            />
          ) : (
            <SiblingAutogroupedBar
              virtualizedIndex={virtualizedIndex}
              viewManager={props.viewManager}
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
        className="TraceRow"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} viewManager={props.viewManager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
                >
                  {props.node.children.length}{' '}
                </ChildrenCountButton>
              ) : null}
            </div>
            <ProjectBadge project={props.projects[props.node.value.project_slug]} />
            <span className="TraceOperation">{props.node.value['transaction.op']}</span>
            <strong className="TraceEmDash"> — </strong>
            <span>{props.node.value.transaction}</span>
            {props.node.canFetchData ? (
              <button
                onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}
              >
                {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
              </button>
            ) : null}
          </div>
        </div>
        <div
          ref={r =>
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            viewManager={props.viewManager}
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
        className="TraceRow"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} viewManager={props.viewManager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
                >
                  {props.node.children.length}{' '}
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
              <button
                onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}
              >
                {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
              </button>
            ) : null}
          </div>
        </div>
        <div
          ref={r =>
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            viewManager={props.viewManager}
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
        className="TraceRow"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} viewManager={props.viewManager} />
            </div>
            <span className="TraceOperation">{t('Missing instrumentation')}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            viewManager={props.viewManager}
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
        className="TraceRow"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper Root">
              <Connectors node={props.node} viewManager={props.viewManager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
                >
                  {props.node.children.length}{' '}
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
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          {' '}
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            viewManager={props.viewManager}
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
        className="TraceRow"
        onClick={() => props.onRowClick(props.index, props.node)}
        onKeyDown={event => props.onRowKeyDown(event, props.index, props.node)}
        style={{
          top: props.style.top,
          height: props.style.height,
        }}
      >
        <div
          className="TraceLeftColumn"
          ref={r =>
            props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
          }
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{
              paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} viewManager={props.viewManager} />
              {props.node.children.length > 0 ? (
                <ChildrenCountButton
                  expanded={props.node.expanded || props.node.zoomedIn}
                  onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
                >
                  {props.node.children.length}{' '}
                </ChildrenCountButton>
              ) : null}
            </div>

            <span className="TraceOperation">{t('Error')}</span>
            <strong className="TraceEmDash"> — </strong>
            <span className="TraceDescription">{props.node.value.title}</span>
          </div>
        </div>
        <div
          ref={r =>
            props.viewManager.registerColumnRef(
              'span_list',
              r,
              virtualizedIndex,
              props.node
            )
          }
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
          }}
        >
          {/* @TODO: figure out what to do with trace errors */}{' '}
          {/* <TraceBar
          space={props.space}
          start_timestamp={props.node.value.start_timestamp}
          timestamp={props.node.value.timestamp}
        /> */}
        </div>
      </div>
    );
  }

  return null;
}

function RenderPlaceholderRow(props: {
  index: number;
  node: TraceTreeNode<TraceTree.NodeValue>;
  projects: Record<Project['slug'], Project>;
  startIndex: number;
  style: React.CSSProperties;
  theme: Theme;
  viewManager: VirtualizedViewManager;
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
        style={{width: props.viewManager.columns.list.width * 100 + '%'}}
      >
        <div
          className="TraceLeftColumnInner"
          style={{
            paddingLeft: props.node.depth * props.viewManager.row_depth_padding,
          }}
        >
          <div
            className={`TraceChildrenCountWrapper ${isTraceNode(props.node) ? 'Root' : ''}`}
          >
            <Connectors node={props.node} viewManager={props.viewManager} />
            {props.node.children.length > 0 ? (
              <ChildrenCountButton
                expanded={props.node.expanded || props.node.zoomedIn}
                onClick={() => void 0}
              >
                {props.node.children.length}{' '}
              </ChildrenCountButton>
            ) : null}
          </div>
          <Placeholder
            className="Placeholder"
            height="12px"
            width={randomBetween(20, 80) + '%'}
            style={{
              transition: 'all 5s ease-out',
            }}
          />
        </div>
      </div>
      <div
        className="TraceRightColumn"
        style={{
          width: props.viewManager.columns.span_list.width * 100 + '%',
          backgroundColor:
            props.index % 2 === 0 ? props.theme.backgroundSecondary : undefined,
        }}
      >
        <Placeholder
          className="Placeholder"
          height="12px"
          width={randomBetween(20, 80) + '%'}
          style={{
            transition: 'all 5s ease-out',
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
  node: TraceTreeNode<TraceTree.NodeValue>;
  viewManager: VirtualizedViewManager;
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
                Math.abs(Math.abs(c) - props.node.depth) *
                props.viewManager.row_depth_padding
              ),
            }}
            data-connector={c}
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
  onClick: () => void;
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
  node_space: [number, number] | null;
  viewManager: VirtualizedViewManager;
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
        viewManager={props.viewManager}
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
            viewManager={props.viewManager}
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
  const spanTransform = props.viewManager.computeSpanCSSMatrixTransform(props.node_space);
  const [inside, textTransform] = props.viewManager.computeSpanTextPlacement(
    props.node_space,
    duration
  );

  return (
    <Fragment>
      <div
        ref={r =>
          props.viewManager.registerSpanBarRef(
            r,
            props.node_space!,
            props.virtualizedIndex
          )
        }
        className="TraceBar"
        style={{
          transform: `matrix(${spanTransform.join(',')})`,
          backgroundColor: props.color,
        }}
        onDoubleClick={() => props.viewManager.onZoomIntoSpace(props.node_space!)}
      />
      <div
        ref={r =>
          props.viewManager.registerSpanBarTextRef(
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
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 0 1px ${p => p.theme.border};
  border-radius: ${space(0.5)};

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

  .TraceIndicator {
    z-index: 1;
    width: 3px;
    height: 100%;
    top: 0;
    position: absolute;

    .TraceIndicatorLine {
      width: 1px;
      height: 100%;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
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

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
    }
    &:focus {
      transition: none;
      background-color: ${p => p.theme.backgroundTertiary};
      outline: none;
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
