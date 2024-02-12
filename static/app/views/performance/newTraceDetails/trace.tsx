import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, List} from 'react-virtualized';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
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
  const api = useApi();
  const organization = useOrganization();
  const virtualizedListRef = useRef<List>(null);
  const theme = useTheme();

  const traceTree = useMemo(() => {
    if (!props.trace) {
      return TraceTree.Empty();
    }

    return TraceTree.FromTrace(props.trace);
  }, [props.trace]);

  const [_rerender, setRender] = useState(0);

  const viewManager = useRef<VirtualizedViewManager | null>(null);
  if (!viewManager.current) {
    viewManager.current = new VirtualizedViewManager({
      list: {width: 0.5, column_refs: []},
      span_list: {width: 0.5, column_refs: []},
    });
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

  const {projects} = useProjects();

  const projectLookup = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project>>((acc, project) => {
      acc[project.slug] = project;
      return acc;
    }, {});
  }, [projects]);

  const containerSpace = useRef<[number, number] | null>(null);
  if (!containerSpace.current) {
    containerSpace.current = traceTree.list?.[0]?.space;
  }

  return (
    <TraceStylingWrapper
      ref={r => viewManager.current?.onContainerRef(r)}
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
              return (
                <RenderRow
                  key={p.key}
                  theme={theme}
                  startIndex={
                    (p.parent as unknown as {_rowStartIndex: number})._rowStartIndex
                  }
                  index={p.index}
                  style={p.style}
                  trace_id={props.trace_id}
                  space={containerSpace.current}
                  projects={projectLookup}
                  node={treeRef.current.list?.[p.index]}
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
  space: [number, number] | null;
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
          ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{paddingLeft: props.node.depth * 23}}
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
          ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            color={pickBarColor('autogrouping')}
            space={props.space}
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
          ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{paddingLeft: props.node.depth * 23}}
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
          ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            color={pickBarColor(props.node.value['transaction.op'])}
            space={props.space}
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
          ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{paddingLeft: props.node.depth * 23}}
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
          ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            color={pickBarColor(props.node.value.op)}
            space={props.space}
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
          ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{paddingLeft: props.node.depth * 23}}
          >
            <div className="TraceChildrenCountWrapper">
              <Connectors node={props.node} />
            </div>
            <span className="TraceOperation">{t('Missing instrumentation')}</span>
          </div>
        </div>
        <div
          ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            color={pickBarColor('missing-instrumentation')}
            space={props.space}
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
          ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
          style={{
            width: props.viewManager.columns.list.width * 100 + '%',
          }}
        >
          <div
            className="TraceLeftColumnInner"
            style={{paddingLeft: props.node.depth * 23}}
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
          ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
          className="TraceRightColumn"
          style={{
            width: props.viewManager.columns.span_list.width * 100 + '%',
            backgroundColor:
              props.index % 2 ? undefined : props.theme.backgroundSecondary,
          }}
        >
          <TraceBar
            color={pickBarColor('missing-instrumentation')}
            space={props.space}
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
        paddingLeft: props.node.depth * 23,
      }}
    >
      <div
        className="TraceLeftColumn"
        ref={r => props.viewManager.registerColumnRef('list', r, virtualizedIndex)}
        style={{
          width:
            (props.viewManager.columns.list.width / props.viewManager.width) * 100 + '%',
        }}
      >
        <div
          className="TraceLeftColumnInner"
          style={{paddingLeft: props.node.depth * 23}}
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
        ref={r => props.viewManager.registerColumnRef('span_list', r, virtualizedIndex)}
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

function Connectors(props: {node: TraceTreeNode<TraceTree.NodeValue>}) {
  const showVerticalConnector =
    ((props.node.expanded || props.node.zoomedIn) && props.node.children.length > 0) ||
    (props.node.value && 'autogrouped_by' in props.node.value);

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
  space: [number, number] | null;
}
function TraceBar(props: TraceBarProps) {
  if (!props.space || !props.node_space) {
    return <Fragment>missing space or node space</Fragment>;
  }

  const scaleX = props.node_space[1] / props.space[1];
  const left = (props.node_space[0] - props.space[0]) / props.space[1];

  return (
    <div
      className="TraceBar"
      style={{
        left: `${left * 100}%`,
        position: 'absolute',
        transform: `matrix(${scaleX}, 0, 0, 1, ${0}, 0)`,
        backgroundColor: props.color,
      }}
    />
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
      width: 100%;
      height: 100%;
      white-space: nowrap;
      display: flex;
      align-items: center;
    }
  }

  .TraceRightColumn {
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    will-change: width;
  }

  .TraceBar {
    height: 64%;
    width: 100%;
    background-color: black;
    transform-origin: left center;
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
