import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, List} from 'react-virtualized';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
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
  isTransactionNode,
} from './guards';
import {ParentAutogroupNode, TraceTree, type TraceTreeNode} from './traceTree';

interface TraceProps {
  trace: TraceSplitResults<TraceFullDetailed> | null;
  trace_id: string;
}

export function Trace(props: TraceProps) {
  const api = useApi();
  const organization = useOrganization();
  const virtualizedListRef = useRef<List>(null);

  const traceTree = useMemo(() => {
    if (!props.trace) {
      return TraceTree.Empty();
    }

    return TraceTree.FromTrace(props.trace);
  }, [props.trace]);

  const [_rerender, setRender] = useState(0);
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

  return (
    <TraceStylingWrapper
      style={{
        padding: 24,
        backgroundColor: '#FFF',
        height: '100%',
        width: '100%',
        position: 'absolute',
      }}
    >
      <AutoSizer>
        {({width, height}) => (
          <List
            ref={virtualizedListRef}
            rowHeight={24}
            height={height}
            width={width}
            overscanRowCount={10}
            rowCount={treeRef.current.list.length ?? 0}
            rowRenderer={p => (
              <RenderRow
                trace_id={props.trace_id}
                index={p.index}
                projects={projectLookup}
                node={treeRef.current.list?.[p.index]}
                style={p.style}
                onFetchChildren={handleFetchChildren}
                onExpandNode={handleExpandNode}
              />
            )}
          />
        )}
      </AutoSizer>
    </TraceStylingWrapper>
  );
}

function RenderRow(props: {
  index: number;
  node: TraceTreeNode<TraceTree.NodeValue>;
  onExpandNode: (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => void;
  onFetchChildren: (node: TraceTreeNode<TraceTree.NodeValue>, value: boolean) => void;
  projects: Record<Project['slug'], Project>;
  style: React.CSSProperties;
  trace_id: string;
}) {
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
    );
  }

  if (isTransactionNode(props.node)) {
    return (
      <div
        className="TraceRow"
        style={{
          top: props.style.top,
          height: props.style.height,
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
          <button onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}>
            {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
          </button>
        ) : null}
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
          <button onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}>
            {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
          </button>
        ) : null}
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
          paddingLeft: props.node.depth * 23,
        }}
      >
        <div className="TraceChildrenCountWrapper">
          <Connectors node={props.node} />
        </div>
        <span className="TraceOperation">{t('Missing instrumentation')}</span>
      </div>
    );
  }

  if ('orphan_errors' in props.node.value) {
    return (
      <div
        className="TraceRow"
        style={{
          top: props.style.top,
          height: props.style.height,
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

/**
 * This is a wrapper around the Trace component to apply styles
 * to the trace tree. It exists because we _do not_ want to trigger
 * emotion's css parsing logic as it is very slow and will cause
 * the scrolling to flicker.
 */
const TraceStylingWrapper = styled('div')`
  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    width: 100%;
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
