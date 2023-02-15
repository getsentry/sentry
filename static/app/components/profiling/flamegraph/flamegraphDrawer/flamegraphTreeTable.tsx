import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {
  useVirtualizedTree,
  UseVirtualizedTreeProps,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

import {FrameCallersTableCell} from './flamegraphDrawer';
import {FlamegraphTreeContextMenu} from './flamegraphTreeContextMenu';
import {FlamegraphTreeTableRow} from './flamegraphTreeTableRow';

function makeSortFunction(
  property: 'total weight' | 'self weight' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'total weight') {
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

  if (property === 'self weight') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.selfWeight - a.node.node.selfWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.selfWeight - b.node.node.selfWeight;
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

interface FlamegraphTreeTableProps {
  canvasPoolManager: CanvasPoolManager;
  canvasScheduler: CanvasScheduler;
  flamegraph: Flamegraph;
  formatDuration: Flamegraph['formatter'];
  getFrameColor: (frame: FlamegraphFrame) => string;
  recursion: 'collapsed' | null;
  referenceNode: FlamegraphFrame;
  tree: FlamegraphFrame[];
  expanded?: boolean;
}

export function FlamegraphTreeTable({
  tree,
  expanded,
  referenceNode,
  canvasPoolManager,
  canvasScheduler,
  getFrameColor,
  formatDuration,
  recursion,
  flamegraph,
}: FlamegraphTreeTableProps) {
  const [scrollContainerRef, setScrollContainerRef] = useState<HTMLDivElement | null>(
    null
  );
  const [sort, setSort] = useState<'total weight' | 'self weight' | 'name'>(
    'total weight'
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const [clickedContextMenuNode, setClickedContextMenuClose] =
    useState<VirtualizedTreeNode<FlamegraphFrame> | null>(null);
  const contextMenu = useContextMenu({container: scrollContainerRef});

  const handleZoomIntoFrameClick = useCallback(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('zoom at frame', [clickedContextMenuNode.node, 'exact']);
    canvasPoolManager.dispatch('highlight frame', [
      [clickedContextMenuNode.node],
      'selected',
    ]);
  }, [canvasPoolManager, clickedContextMenuNode]);

  const onHighlightAllOccurencesClick = useCallback(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('highlight frame', [
      flamegraph.findAllMatchingFrames(clickedContextMenuNode.node),
      'selected',
    ]);
  }, [canvasPoolManager, clickedContextMenuNode, flamegraph]);

  const renderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] = useCallback(
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
        <FlamegraphTreeTableRow
          ref={n => {
            r.ref = n;
          }}
          node={r.item}
          style={r.styles}
          referenceNode={referenceNode}
          frameColor={getFrameColor(r.item.node)}
          formatDuration={formatDuration}
          tabIndex={selectedNodeIndex === r.key ? 0 : 1}
          onClick={handleRowClick}
          onExpandClick={handleExpandTreeNode}
          onKeyDown={handleRowKeyDown}
          onMouseEnter={handleRowMouseEnter}
          onContextMenu={evt => {
            setClickedContextMenuClose(r.item);
            contextMenu.handleContextMenu(evt);
          }}
        />
      );
    },
    [contextMenu, formatDuration, referenceNode, getFrameColor]
  );

  // This is slighlty unfortunate and ugly, but because our two columns are sticky
  // we need to scroll the container to the left when we scroll to a node. This
  // should be resolved when we split the virtualization between containers and sync scroll,
  // but is a larger undertaking and will take a bit longer
  const onScrollToNode: UseVirtualizedTreeProps<FlamegraphFrame>['onScrollToNode'] =
    useCallback(
      (
        node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
        scrollContainer: HTMLElement | null,
        coordinates?: {depth: number; top: number}
      ) => {
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
            scrollContainer?.scrollBy({
              left,
            });
          }
        } else if (coordinates) {
          const left = -328 + (coordinates.depth * 14 + 8);
          scrollContainer?.scrollBy({
            left,
          });
        }
      },
      []
    );

  const {
    renderedItems,
    scrollContainerStyles,
    containerStyles,
    handleSortingChange,
    handleScrollTo,
    clickedGhostRowRef,
    hoveredGhostRowRef,
  } = useVirtualizedTree({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    onScrollToNode,
    renderRow,
    scrollContainer: scrollContainerRef,
    rowHeight: 24,
    tree,
  });

  const onSortChange = useCallback(
    (newSort: 'total weight' | 'self weight' | 'name') => {
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

    canvasScheduler.on('show in table view', onShowInTableView);
    return () => canvasScheduler.off('show in table view', onShowInTableView);
  }, [canvasScheduler, handleScrollTo]);

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('self weight')}>
              <InteractionStateLayer />
              <span>
                {t('Self Time')}{' '}
                <QuestionTooltip
                  title={t(
                    'Self time is the amount of time spent by this function excluding the time spent by other functions called within it.'
                  )}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'self weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('total weight')}>
              <InteractionStateLayer />
              <span>
                {t('Total Time')}{' '}
                <QuestionTooltip
                  title={t(
                    'Total time is the total amount of time spent by this function.'
                  )}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'total weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameNameCell>
            <TableHeaderButton onClick={() => onSortChange('name')}>
              <InteractionStateLayer />
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameNameCell>
        </FrameCallersTableHeader>
        <FlamegraphTreeContextMenu
          onZoomIntoFrameClick={handleZoomIntoFrameClick}
          onHighlightAllFramesClick={onHighlightAllOccurencesClick}
          contextMenu={contextMenu}
        />
        <TableItemsContainer>
          {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
          <div ref={hoveredGhostRowRef} />
          <div ref={clickedGhostRowRef} />
          <div
            ref={setScrollContainerRef}
            style={scrollContainerStyles}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <div style={containerStyles}>
              {renderedItems}
              {/*
              This is a ghost row, we stretch its width and height to fit the entire table
              so that borders on columns are shown across the entire table and not just the rows.
              This is useful when number of rows does not fill up the entire table height.
             */}
              <GhostRowContainer>
                <FrameCallersTableCell />
                <FrameCallersTableCell />
                <FrameCallersTableCell style={{width: '100%'}} />
              </GhostRowContainer>
            </div>
          </div>
        </TableItemsContainer>
      </FrameCallersTable>
    </FrameBar>
  );
}

const TableItemsContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  background: ${p => p.theme.background};
`;

const GhostRowContainer = styled('div')`
  display: flex;
  width: 100%;
  pointer-events: none;
  position: absolute;
  height: 100%;
  z-index: -1;
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

const FrameCallersTable = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
  overflow: auto;
  max-height: 100%;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;

const FrameWeightCell = styled('div')`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;

const FrameNameCell = styled('div')`
  flex: 1 1 100%;
`;

const FrameCallersTableHeader = styled('div')`
  top: 0;
  position: sticky;
  z-index: 1;
  display: flex;
  flex: 1;

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
