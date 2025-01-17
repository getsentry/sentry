import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import type {UseVirtualizedTreeProps} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import type {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {relativeWeight} from 'sentry/utils/profiling/units/units';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {AggregateFlamegraphTreeContextMenu} from './aggregateFlamegraphTreeContextMenu';
import {
  CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX,
  CallTreeDynamicColumnsContainer,
  CallTreeFixedColumnsContainer,
  CallTreeTable,
  CallTreeTableContainer,
  CallTreeTableDynamicColumns,
  CallTreeTableFixedColumns,
  CallTreeTableGhostRow,
  CallTreeTableHeader,
  CallTreeTableHeaderButton,
  CallTreeTableRow,
  syncCallTreeTableScroll,
} from './callTreeTable';

function makeSortFunction(
  property: 'sample count' | 'duration' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'sample count') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.totalWeight - a.node.node.totalWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.totalWeight - b.node.node.totalWeight;
        };
  }

  if (property === 'duration') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.aggregate_duration_ns - a.node.node.aggregate_duration_ns;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.aggregate_duration_ns - b.node.node.aggregate_duration_ns;
        };
  }

  if (property === 'name') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.frame.name.localeCompare(b.node.frame.name);
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.frame.name.localeCompare(a.node.frame.name);
        };
  }

  throw new Error(`Unknown sort property ${property}`);
}

function skipRecursiveNodes(n: VirtualizedTreeNode<FlamegraphFrame>): boolean {
  return n.node.node.isDirectRecursive();
}

interface AggregateFlamegraphTreeTableProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  recursion: 'collapsed' | null;
  expanded?: boolean;
  withoutBorders?: boolean;
}

export function AggregateFlamegraphTreeTable({
  expanded,
  recursion,
  frameFilter,
  withoutBorders,
}: AggregateFlamegraphTreeTableProps) {
  const dispatch = useDispatchFlamegraphState();
  const profiles = useFlamegraphProfiles();
  const profileGroup = useProfileGroup();
  const flamegraph = useFlamegraph();
  const theme = useFlamegraphTheme();
  const referenceNode = flamegraph.root;

  const [treeView, setTreeView] = useLocalStorageState<'bottom up' | 'top down'>(
    'profiling-aggregate-call-tree-view',
    'bottom up'
  );

  const rootNodes = useMemo(() => {
    return flamegraph.root.children;
  }, [flamegraph.root.children]);

  const tree: FlamegraphFrame[] | null = useMemo(() => {
    function skipFunction(frame: FlamegraphFrame): boolean {
      return frameFilter === 'application'
        ? !frame.frame.is_application
        : frameFilter === 'system'
          ? frame.frame.is_application
          : false;
    }

    const maybeFilteredRoots =
      frameFilter === 'all' ? rootNodes : filterFlamegraphTree(rootNodes, skipFunction);

    if (treeView === 'top down') {
      return maybeFilteredRoots;
    }
    return invertCallTree(maybeFilteredRoots);
  }, [frameFilter, rootNodes, treeView]);

  const {colorMap} = useMemo(() => {
    return theme.COLORS.STACK_TO_COLOR(
      flamegraph.frames,
      theme.COLORS.COLOR_MAPS['by symbol name'],
      theme.COLORS.COLOR_BUCKET,
      theme
    );
  }, [theme, flamegraph.frames]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      return formatColorForFrame(
        frame,
        colorMap.get(frame.key) ?? theme.COLORS.FRAME_FALLBACK_COLOR
      );
    },
    [theme, colorMap]
  );

  useEffect(() => {
    if (defined(profiles.threadId)) {
      return;
    }
    const threadID =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : null;
    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (defined(threadID)) {
      dispatch({
        type: 'set thread id',
        payload: threadID,
      });
    }
  }, [profileGroup, profiles.threadId, dispatch]);

  const [scrollContainerRef, setFixedScrollContainerRef] =
    useState<HTMLDivElement | null>(null);
  const [dynamicScrollContainerRef, setDynamicScrollContainerRef] =
    useState<HTMLDivElement | null>(null);
  const [sort, setSort] = useState<'sample count' | 'duration' | 'name'>('sample count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const [tableParentContainer, setTableParentContainer] = useState<HTMLDivElement | null>(
    null
  );
  const contextMenu = useContextMenu({container: tableParentContainer});

  const fixedRenderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] =
    useCallback(
      (
        r: any,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }: any
      ) => {
        return (
          <CallTreeTableRow
            key={r.key}
            ref={n => {
              r.ref = n;
            }}
            top={r.styles.top}
            tabIndex={selectedNodeIndex === r.key ? 0 : 1}
            onKeyDown={handleRowKeyDown}
            onClick={handleRowClick}
            onMouseEnter={handleRowMouseEnter}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <CallTreeTableFixedColumns
              type="count"
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              totalWeight={
                <PerformanceDuration
                  nanoseconds={r.item.node.node.aggregate_duration_ns}
                  abbreviation
                />
              }
              selfWeight={r.item.node.node.totalWeight.toFixed(0)}
              relativeSelfWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.totalWeight
              )}
              relativeTotalWeight={relativeWeight(
                referenceNode.node.aggregate_duration_ns,
                r.item.node.node.aggregate_duration_ns
              )}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, contextMenu]
    );

  const dynamicRenderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] =
    useCallback(
      (
        r: any,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }: any
      ) => {
        return (
          <CallTreeTableRow
            key={r.key}
            ref={n => {
              r.ref = n;
            }}
            top={r.styles.top}
            tabIndex={selectedNodeIndex === r.key ? 0 : 1}
            onKeyDown={handleRowKeyDown}
            onClick={handleRowClick}
            onMouseEnter={handleRowMouseEnter}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <CallTreeTableDynamicColumns
              type="count"
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, contextMenu]
    );

  const onScrollToNode: UseVirtualizedTreeProps<FlamegraphFrame>['onScrollToNode'] =
    useCallback(
      (
        node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
        scrollContainer: HTMLElement | HTMLElement[] | null,
        coordinates?: {depth: number; top: number}
      ) => {
        syncCallTreeTableScroll({node, scrollContainer, coordinates});
      },
      []
    );

  const virtualizedTree = useMemo(() => {
    return VirtualizedTree.fromRoots(tree ?? []);
  }, [tree]);

  const scrollContainers = useMemo(() => {
    return [scrollContainerRef, dynamicScrollContainerRef].filter(
      c => !!c
    ) as HTMLElement[];
  }, [dynamicScrollContainerRef, scrollContainerRef]);

  const {
    items: renderItems,
    scrollContainerStyles: scrollContainerStyles,
    containerStyles: fixedContainerStyles,
    handleSortingChange,
    handleExpandTreeNode,
    handleRowClick,
    handleRowKeyDown,
    handleRowMouseEnter,
    selectedNodeIndex,
    clickedGhostRowRef: clickedGhostRowRef,
    hoveredGhostRowRef: hoveredGhostRowRef,
  } = useVirtualizedTree({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    onScrollToNode,
    scrollContainer: scrollContainers,
    rowHeight: 24,
    tree,
    virtualizedTree,
  });

  const onSortChange = useCallback(
    (newSort: 'sample count' | 'duration' | 'name') => {
      const newDirection =
        newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

      setDirection(newDirection);
      setSort(newSort);

      const sortFn = makeSortFunction(newSort, newDirection);
      handleSortingChange(sortFn);
    },
    [sort, direction, handleSortingChange]
  );

  const onSortBySampleCount = useCallback(() => {
    onSortChange('sample count');
  }, [onSortChange]);

  const onSortByName = useCallback(() => {
    onSortChange('name');
  }, [onSortChange]);

  const onSortByDuration = useCallback(() => {
    onSortChange('duration');
  }, [onSortChange]);

  const onBottomUpClick = useCallback(() => {
    setTreeView('bottom up');
  }, [setTreeView]);

  const onTopDownClick = useCallback(() => {
    setTreeView('top down');
  }, [setTreeView]);

  return (
    <FrameBar withoutBorders={withoutBorders}>
      <CallTreeTable>
        <CallTreeTableHeader>
          <FrameWeightCell>
            <CallTreeTableHeaderButton onClick={onSortBySampleCount}>
              <InteractionStateLayer />
              <span>
                {t('Samples')}{' '}
                <QuestionTooltip
                  title={t('How often this frame appeared in stack samples.')}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'sample count' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </CallTreeTableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <CallTreeTableHeaderButton onClick={onSortByDuration}>
              <InteractionStateLayer />
              <span>
                {t('Duration')}{' '}
                <QuestionTooltip
                  title={t('Aggregated duration of this frame across different samples')}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'duration' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </CallTreeTableHeaderButton>
          </FrameWeightCell>
          <div>
            <CallTreeTableHeaderButton onClick={onSortByName}>
              <InteractionStateLayer />
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </CallTreeTableHeaderButton>
          </div>
        </CallTreeTableHeader>
        <CallTreeTableContainer ref={setTableParentContainer}>
          <AggregateFlamegraphTreeContextMenu
            onBottomUpClick={onBottomUpClick}
            onTopDownClick={onTopDownClick}
            contextMenu={contextMenu}
          />
          <CallTreeFixedColumnsContainer>
            {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
            <div ref={setFixedScrollContainerRef} style={scrollContainerStyles}>
              <div style={fixedContainerStyles}>
                {renderItems.map(r => {
                  return fixedRenderRow(r, {
                    handleRowClick: handleRowClick(r.key),
                    handleRowMouseEnter: handleRowMouseEnter(r.key),
                    handleExpandTreeNode,
                    handleRowKeyDown,
                    selectedNodeIndex,
                  });
                })}
                <CallTreeTableGhostRow />
              </div>
            </div>
          </CallTreeFixedColumnsContainer>
          <CallTreeDynamicColumnsContainer>
            {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
            <div ref={setDynamicScrollContainerRef} style={scrollContainerStyles}>
              <div style={fixedContainerStyles}>
                {renderItems.map(r => {
                  return dynamicRenderRow(r, {
                    handleRowClick: handleRowClick(r.key),
                    handleRowMouseEnter: handleRowMouseEnter(r.key),
                    handleExpandTreeNode,
                    handleRowKeyDown,
                    selectedNodeIndex,
                  });
                })}
              </div>
            </div>
          </CallTreeDynamicColumnsContainer>
          <div ref={hoveredGhostRowRef} style={{zIndex: 0}} />
          <div ref={clickedGhostRowRef} style={{zIndex: 0}} />
        </CallTreeTableContainer>
      </CallTreeTable>
    </FrameBar>
  );
}

const FrameBar = styled('div')<{withoutBorders?: boolean}>`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface200};
  ${p => !p.withoutBorders && `border-top: 1px solid ${p.theme.border};`}
  flex: 1 1 100%;
`;

const FrameWeightCell = styled('div')`
  width: ${CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;
