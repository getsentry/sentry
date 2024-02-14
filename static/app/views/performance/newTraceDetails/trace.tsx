import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, List} from 'react-virtualized';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
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
import {ParentAutogroupNode, TraceTree, type TraceTreeNode} from './traceTree';
import {VirtualizedViewManager} from './virtualizedViewManager';

interface TraceProps {
  trace: TraceSplitResults<TraceFullDetailed> | null;
  trace_id: string;
}

export function Trace(props: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const virtualizedListRef = useRef<List>(null);
  const viewManager = useRef<VirtualizedViewManager | null>(null);

  const [_rerender, setRender] = useState(0);

  const traceTree = useMemo(() => {
    if (!props.trace) {
      return TraceTree.Loading({
        project_slug: projects?.[0]?.slug ?? '',
        event_id: props.trace_id,
      });
    }

    return TraceTree.FromTrace(props.trace);
  }, [props.trace, props.trace_id, projects]);

  if (!viewManager.current) {
    viewManager.current = new VirtualizedViewManager({
      list: {width: 0.5, column_refs: []},
      span_list: {width: 0.5, column_refs: []},
    });
  }

  if (
    traceTree.root.space &&
    (traceTree.root.space[0] !== viewManager.current.spanSpace[0] ||
      traceTree.root.space[1] !== viewManager.current.spanSpace[1])
  ) {
    viewManager.current.initializeSpanSpace(traceTree.root.space);
  }

  const treeRef = useRef<TraceTree>(traceTree);
  treeRef.current = traceTree;

  const handleFetchChildren = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => {
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

  const projectLookup = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project>>((acc, project) => {
      acc[project.slug] = project;
      return acc;
    }, {});
  }, [projects]);

  return (
    <Fragment>
      <TraceStylingWrapper
        ref={r => viewManager.current?.onContainerRef(r)}
        className={traceTree.type === 'loading' ? 'Loading' : ''}
        style={{
          backgroundColor: '#FFF',
          height: '100%',
          width: '100%',
          position: 'absolute',
        }}
      >
        <TraceDivider ref={r => viewManager.current?.registerDividerRef(r)} />
        <AutoSizer>
          {({width, height}) => (
            <List
              ref={virtualizedListRef}
              rowHeight={24}
              height={height}
              width={width}
              overscanRowCount={10}
              rowCount={treeRef.current.list.length ?? 0}
              rowRenderer={p => {
                return traceTree.type === 'loading' ? (
                  <RenderPlaceholderRow
                    style={p.style}
                    node={treeRef.current.list[p.index]}
                    index={p.index}
                    theme={theme}
                    projects={projectLookup}
                    viewManager={viewManager.current!}
                    startIndex={
                      (p.parent as unknown as {_rowStartIndex: number})._rowStartIndex
                    }
                  />
                ) : (
                  <RenderRow
                    key={p.key}
                    theme={theme}
                    startIndex={
                      (p.parent as unknown as {_rowStartIndex: number})._rowStartIndex
                    }
                    index={p.index}
                    style={p.style}
                    trace_id={props.trace_id}
                    projects={projectLookup}
                    node={treeRef.current.list[p.index]}
                    viewManager={viewManager.current!}
                    onFetchChildren={handleFetchChildren}
                    onExpandNode={handleExpandNode}
                  />
                );
              }}
            />
          )}
        </AutoSizer>
      </TraceStylingWrapper>
    </Fragment>
  );
}

const TraceDivider = styled('div')`
  position: absolute;
  height: 100%;
  background-color: transparent;
  top: 0;
  z-index: 1;
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
  projects: Record<Project['slug'], Project>;
  startIndex: number;
  style: React.CSSProperties;
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
        className="TraceRow Autogrouped"
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
              paddingLeft: props.node.depth * 23,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} />
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
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            virtualizedIndex={virtualizedIndex}
            viewManager={props.viewManager}
            color={pickBarColor('autogrouping')}
            node_space={props.node.space}
          />
        </div>
      </div>
    );
  }

  if (isTransactionNode(props.node)) {
    return (
      <div
        className="TraceRow"
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
              paddingLeft: props.node.depth * 23,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} />
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
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
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
        className="TraceRow"
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
              paddingLeft: props.node.depth * 23,
            }}
          >
            <div
              className={`TraceChildrenCountWrapper ${
                props.node.isOrphaned ? 'Orphaned' : ''
              }`}
            >
              <Connectors node={props.node} />
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
            <span className="TraceDescription">
              {props.node.value.description ?? '<unknown>'}
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
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
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
        className="TraceRow"
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
              paddingLeft: props.node.depth * 23,
            }}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} />
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
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
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
        className="TraceRow"
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
              paddingLeft: props.node.depth * 23,
            }}
          >
            <div className="TraceChildrenCountWrapper Root">
              <Connectors node={props.node} />
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
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
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

  if (isTraceErrorNode(props.node)) {
    <div
      className="TraceRow"
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
          width:
            (props.viewManager.columns.list.width / props.viewManager.width) * 100 + '%',
        }}
      >
        <div
          className="TraceLeftColumnInner"
          style={{
            paddingLeft: props.node.depth * 23,
          }}
        >
          <div className="TraceChildrenCountWrapper">
            <Connectors node={props.node} />
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
          backgroundColor: props.index % 2 ? undefined : props.theme.backgroundSecondary,
        }}
      >
        {/* @TODO: figure out what to do with trace errors */}
        {/* <TraceBar
          space={props.space}
          start_timestamp={props.node.value.start_timestamp}
          timestamp={props.node.value.timestamp}
        /> */}
      </div>
    </div>;
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
  const virtualizedIndex = props.index - props.startIndex;
  return (
    <div
      className="TraceRow"
      style={{
        top: props.style.top,
        height: props.style.height,
        pointerEvents: 'none',
        color: props.theme.subText,
        animationDelay: `${virtualizedIndex * 0.05}s`,
      }}
    >
      <div
        className="TraceLeftColumn"
        ref={r =>
          props.viewManager.registerColumnRef('list', r, virtualizedIndex, props.node)
        }
        style={{width: props.viewManager.columns.list.width * 100 + '%'}}
      >
        <div
          className="TraceLeftColumnInner"
          style={{
            paddingLeft: props.node.depth * 23,
          }}
        >
          <div className="TraceChildrenCountWrapper">
            <Connectors node={props.node} />
            {props.node.children.length > 0 ? (
              <ChildrenCountButton
                expanded={props.node.expanded || props.node.zoomedIn}
                onClick={() => void 0}
              >
                {props.node.children.length}{' '}
              </ChildrenCountButton>
            ) : null}
          </div>
          {isTraceNode(props.node) ? <SmallLoadingIndicator /> : null}
          {isTraceNode(props.node) ? (
            'Loading trace...'
          ) : (
            <Placeholder className="Placeholder" height="10px" width="86%" />
          )}
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
        }}
      >
        {isTraceNode(props.node) ? null : (
          <Placeholder
            className="Placeholder"
            height="14px"
            width="90%"
            style={{margin: 'auto'}}
          />
        )}
      </div>
    </div>
  );
}

function Connectors(props: {node: TraceTreeNode<TraceTree.NodeValue>}) {
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
            style={{left: -(Math.abs(Math.abs(c) - props.node.depth) * 23)}}
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

function SmallLoadingIndicator() {
  return (
    <StyledLoadingIndicator
      style={{display: 'inline-block', margin: 0}}
      size={8}
      hideMessage
      relative
    />
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  transform: translate(-5px, 0);

  div:first-child {
    border-left: 6px solid ${p => p.theme.gray300};
    animation: loading 900ms infinite linear;
  }
`;

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
}
function TraceBar(props: TraceBarProps) {
  if (!props.node_space) {
    return null;
  }

  const spanTransform = props.viewManager.computeSpanMatrixTransform(props.node_space);
  const inverseTransform = props.viewManager.inverseSpanScaling(props.node_space);
  const textPosition = props.viewManager.computeSpanTextPlacement(
    spanTransform[4],
    props.node_space
  );

  return (
    <div
      ref={r =>
        props.viewManager.registerSpanBarRef(r, props.node_space!, props.virtualizedIndex)
      }
      className="TraceBar"
      style={{
        transform: `matrix(${spanTransform.join(',')})`,
        backgroundColor: props.color,
      }}
    >
      <div
        className={`TraceBarDuration ${textPosition === 'inside left' ? 'Inside' : ''}`}
        style={{
          left: textPosition === 'left' || textPosition === 'inside left' ? '0' : '100%',
          transform: `matrix(${inverseTransform}, 0,0,1,0,0) translate(${
            textPosition === 'left' ? 'calc(-100% - 4px)' : '4px'
          }, 0)`,
        }}
      >
        <PerformanceDuration seconds={props.node_space[1]} abbreviation />
      </div>
    </div>
  );
}

/**
 * This is a wrapper around the Trace component to apply styles
 * to the trace tree. It exists because we _do not_ want to trigger
 * emotion's css parsing logic as it is very slow and will cause
 * the scrolling to flicker.
 */
const TraceStylingWrapper = styled('div')`
  position: relative;

  @keyframes show {
    0% {
      opacity: 0;
      transform: translate(0, 2px);
    }
    100% {
      opacity: .7;
      transform: translate(0, 0px);
    }
  };

  @keyframes showPlaceholder {
    0% {
      opacity: 0;
      transform: translate(-8px, 0px);
    }
    100% {
      opacity: .7;
      transform: translate(0, 0px);
    }
  };

  &.Loading {
    .TraceRow {
      opacity: 0;
      animation: show 0.2s ease-in-out forwards;
    }

    .Placeholder {
      opacity: 0;
      transform: translate(-8px, 0px);
      animation: showPlaceholder 0.2s ease-in-out forwards;
    }
  }

  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    width: 100%;
    transition: background-color 0.15s ease-in-out 0s;
    font-size: ${p => p.theme.fontSizeSmall};

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
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

    &.Inside {
      color: ${p => p.theme.gray100};
    }
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
    min-width: 46px;
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
      width: 60%;
      height: 2px;
      border-bottom: 2px solid ${p => p.theme.border};
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }

    &::after {
      content: "";
      background-color: rgb(224, 220, 229);
      border-radius: 50%;
      height: 6px;
      width: 6px;
      position: absolute;
      left: 60%;
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
