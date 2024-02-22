import type React from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, List} from 'react-virtualized';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Omit} from 'framer-motion/types/types';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Placeholder from 'sentry/components/placeholder';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconChevron, IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
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

interface TraceProps {
  trace: TraceTree;
  trace_id: string;
}

function Trace({trace, trace_id}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const viewManager = useRef<VirtualizedViewManager | null>(null);

  const [_rerender, setRender] = useState(0);

  if (!viewManager.current) {
    viewManager.current = new VirtualizedViewManager({
      list: {width: 0.5},
      span_list: {width: 0.5},
    });
  }

  if (
    trace.root.space &&
    (trace.root.space[0] !== viewManager.current.spanSpace[0] ||
      trace.root.space[1] !== viewManager.current.spanSpace[1])
  ) {
    viewManager.current.initializeSpanSpace(trace.root.space);
  }

  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

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
        className={trace.type === 'loading' ? 'Loading' : ''}
        style={{
          backgroundColor: '#FFF',
          height: '70vh',
          width: '100%',
          margin: 'auto',
        }}
      >
        <TraceDivider ref={r => viewManager.current?.registerDividerRef(r)} />
        <AutoSizer>
          {({width, height}) => (
            <Fragment>
              {trace.indicators.length > 0
                ? trace.indicators.map((indicator, i) => {
                    return (
                      <div
                        key={i}
                        ref={r =>
                          viewManager.current?.registerIndicatorRef(r, i, indicator)
                        }
                        className="TraceIndicator"
                      >
                        <div className="TraceIndicatorLine" />
                      </div>
                    );
                  })
                : null}
              <List
                ref={r => viewManager.current?.registerVirtualizedList(r)}
                rowHeight={24}
                height={height}
                width={width}
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
                      viewManager={viewManager.current!}
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
                      index={p.index}
                      style={p.style}
                      trace_id={trace_id}
                      projects={projectLookup}
                      node={treeRef.current.list[p.index]}
                      viewManager={viewManager.current!}
                      onFetchChildren={handleFetchChildren}
                      onExpandNode={handleExpandNode}
                      organization={organization}
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
  organization: Organization;
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
              paddingLeft: props.node.depth * 24,
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
              paddingLeft: props.node.depth * 24,
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
              paddingLeft: props.node.depth * 24,
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
              paddingLeft: props.node.depth * 24,
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
              paddingLeft: props.node.depth * 24,
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
              paddingLeft: props.node.depth * 24,
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

            <ProjectBadge project={props.projects[props.node.value.project_slug]} />
            <Link
              className="Errored Link"
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
          {props.node.value.timestamp ? (
            <div
              className="ErrorIconBorder"
              style={{
                transform: `translateX(${props.viewManager.computeTransformXFromTimestamp(
                  props.node.value.timestamp
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
            paddingLeft: props.node.depth * 24,
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
            style={{left: -(Math.abs(Math.abs(c) - props.node.depth) * 24)}}
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
        {/* Use node space to calculate duration if the duration prop is not provided. */}
        <PerformanceDuration
          seconds={props.duration ?? props.node_space[1]}
          abbreviation
        />
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
  border: 1px solid ${p => p.theme.border};
  padding: ${space(0.5)} 0;
  border-radius: ${space(0.5)};

  @keyframes show {
    0% {
      opacity: 0;
      transform: translate(0, 2px);
    }
    100% {
      opacity: 0.7;
      transform: translate(0, 0px);
    }
  }

  @keyframes showPlaceholder {
    0% {
      opacity: 0;
      transform: translate(-8px, 0px);
    }
    100% {
      opacity: 0.7;
      transform: translate(0, 0px);
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
    min-width: 48px;
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
      content: '';
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
