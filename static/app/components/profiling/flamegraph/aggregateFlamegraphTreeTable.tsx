import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {
  useVirtualizedTree,
  UseVirtualizedTreeProps,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {AggregateFlamegraphTreeContextMenu} from './aggregateFlamegraphTreeContextMenu';
import {
  CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX,
  CallTreeTable,
  CallTreeTableDynamicColumns,
  CallTreeTableFixedColumns,
  CallTreeTableGhostRow,
  CallTreeTableRow,
  DynamicColumnsContainer,
  FixedColumnsContainer,
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
  canvasScheduler: CanvasScheduler;
  frameFilter: 'system' | 'application' | 'all';
  recursion: 'collapsed' | null;
  expanded?: boolean;
}

export function AggregateFlamegraphTreeTable({
  expanded,
  canvasScheduler,
  recursion,
  frameFilter,
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
        colorMap.get(frame.key) ?? theme.COLORS.FRAME_GRAYSCALE_COLOR
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
        r,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }
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

  const dynamicRenderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] =
    useCallback(
      (
        r,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }
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

  // This is slighlty unfortunate and ugly, but because our two columns are sticky
  // we need to scroll the container to the left when we scroll to a node. This
  // should be resolved when we split the virtualization between containers and sync scroll,
  // but is a larger undertaking and will take a bit longer
  const onScrollToNode: UseVirtualizedTreeProps<FlamegraphFrame>['onScrollToNode'] =
    useCallback(
      (
        node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
        scrollContainer: HTMLElement | HTMLElement[] | null,
        coordinates?: {depth: number; top: number}
      ) => {
        if (!scrollContainer) {
          return;
        }
        if (node) {
          const lastCell = node.ref?.lastChild?.firstChild as
            | HTMLElement
            | null
            | undefined;
          if (lastCell) {
            lastCell.scrollIntoView({
              block: 'nearest',
            });

            const left = -328 + (node.item.depth * 14 + 8);
            if (Array.isArray(scrollContainer)) {
              scrollContainer.forEach(c => {
                c.scrollBy({
                  left,
                });
              });
            } else {
              scrollContainer.scrollBy({
                left,
              });
            }
          }
        } else if (coordinates && scrollContainer) {
          const left = -328 + (coordinates.depth * 14 + 8);

          if (Array.isArray(scrollContainer)) {
            scrollContainer.forEach(c => {
              c.scrollBy({
                left,
              });
            });
          } else {
            scrollContainer.scrollBy({
              left,
            });
          }
        }
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
    handleScrollTo,
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

  useEffect(() => {
    function onShowInTableView(frame: FlamegraphFrame) {
      handleScrollTo(el => el.node === frame.node);
    }

    canvasScheduler.on('zoom at frame', onShowInTableView);
    canvasScheduler.on('show in table view', onShowInTableView);
    return () => {
      canvasScheduler.off('show in table view', onShowInTableView);
      canvasScheduler.off('zoom at frame', onShowInTableView);
    };
  }, [canvasScheduler, handleScrollTo]);

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
    <FrameBar>
      <CallTreeTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortBySampleCount}>
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
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortByDuration}>
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
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameNameCell>
            <TableHeaderButton onClick={onSortByName}>
              <InteractionStateLayer />
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameNameCell>
        </FrameCallersTableHeader>
        <AggregateFlamegraphTableContainer ref={setTableParentContainer}>
          <AggregateFlamegraphTreeContextMenu
            onBottomUpClick={onBottomUpClick}
            onTopDownClick={onTopDownClick}
            contextMenu={contextMenu}
          />
          <FixedColumnsContainer>
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
          </FixedColumnsContainer>
          <DynamicColumnsContainer>
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
          </DynamicColumnsContainer>
          <div ref={hoveredGhostRowRef} style={{zIndex: 0}} />
          <div ref={clickedGhostRowRef} style={{zIndex: 0}} />
        </AggregateFlamegraphTableContainer>
      </CallTreeTable>
    </FrameBar>
  );
}

const AggregateFlamegraphTableContainer = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`;

const TableHeaderButton = styled('button')`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)};
  border: none;
  background-color: ${props => props.theme.surface200};
  transition: background-color 100ms ease-in-out;
  line-height: 24px;

  svg {
    width: 10px;
    height: 10px;
  }
`;

const FrameBar = styled('div')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface200};
  border-top: 1px solid ${p => p.theme.border};
  flex: 1 1 100%;
  grid-area: table;
`;

const FrameWeightCell = styled('div')`
  width: ${CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;

const FrameNameCell = styled('div')`
  flex: 1 1 100%;
`;

const FrameCallersTableHeader = styled('div')`
  top: 0;
  position: sticky;
  z-index: 2;
  display: flex;

  > div {
    position: relative;
    border-bottom: 1px solid ${p => p.theme.border};
    background-color: ${p => p.theme.background};
    white-space: nowrap;

    &:last-child {
      flex: 1;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;
