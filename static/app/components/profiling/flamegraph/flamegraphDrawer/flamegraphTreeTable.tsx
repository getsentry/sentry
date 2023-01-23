import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

import {FlamegraphTreeContextMenu} from './flamegraphTreeContextMenu';
import {
  FrameCallersTableCellRight,
  FrameCell,
  FrameSelfWeightCell,
  FrameTotalWeightCell,
} from './flamegraphTreeTableRow';

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
  const [weightScrollContainerRef, setWeightScrollContainerRef] =
    useState<HTMLDivElement | null>(null);

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

  const {
    renderedItemsIterator,
    scrollContainerStyles,
    containerStyles,
    handleSortingChange,
    handleScrollTo,
  } = useVirtualizedTree({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    scrollContainer: scrollContainerRef,
    otherScrollContainer: weightScrollContainerRef,
    rowHeight: 24,
    overscroll: 5,
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

  const onSelfWeightSort = useCallback(() => {
    onSortChange('self weight');
  }, [onSortChange]);

  const onTotalWeightSort = useCallback(() => {
    onSortChange('total weight');
  }, [onSortChange]);

  const onSortByName = useCallback(() => {
    onSortChange('name');
  }, [onSortChange]);

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSelfWeightSort}>
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
            <TableHeaderButton onClick={onTotalWeightSort}>
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
            <TableHeaderButton onClick={onSortByName}>
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
          <FrameScrollContainer
            ref={setWeightScrollContainerRef}
            style={{
              ...scrollContainerStyles,
              width: '328px',
            }}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <FrameWeightsContainer style={containerStyles}>
              {renderedItemsIterator.map(([r, props]) => {
                return (
                  <FrameWeightsRow key={r.key} style={r.styles}>
                    <FrameSelfWeightCell
                      node={r.item}
                      ref={el => el && r.otherRefs.push(el)}
                      referenceNode={referenceNode}
                      formatDuration={formatDuration}
                      tabIndex={props.selectedNodeIndex === r.key ? 0 : 1}
                    />
                    <FrameTotalWeightCell
                      node={r.item}
                      referenceNode={referenceNode}
                      formatDuration={formatDuration}
                      tabIndex={props.selectedNodeIndex === r.key ? 0 : 1}
                    />
                  </FrameWeightsRow>
                );
              })}
            </FrameWeightsContainer>
            <GhostRowContainer>
              <FrameCallersTableCellRight />
              <FrameCallersTableCellRight />
            </GhostRowContainer>
          </FrameScrollContainer>
          <div
            ref={setScrollContainerRef}
            style={{...scrollContainerStyles, width: 'calc(100% - 328px)'}}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <FrameNameRowsContainer style={{...containerStyles, scrollbarWidth: 'none'}}>
              {renderedItemsIterator.map(([r, props]) => {
                return (
                  <FrameCell
                    ref={el => (r.ref = el)}
                    row={r}
                    key={r.key}
                    color={getFrameColor(r.item.node)}
                    tabIndex={props.selectedNodeIndex === r.key ? 0 : 1}
                    style={r.styles}
                    onClick={props.handleRowClick}
                    onKeyDown={props.handleRowKeyDown}
                    onMouseEnter={props.handleRowMouseEnter}
                    onExpandClick={(evt: React.MouseEvent) => {
                      evt.stopPropagation();
                      props.handleExpandTreeNode(r.item, {expandChildren: evt.metaKey});
                    }}
                  />
                );
              })}
            </FrameNameRowsContainer>
          </div>
        </TableItemsContainer>
      </FrameCallersTable>
    </FrameBar>
  );
}

const FrameScrollContainer = styled('div')`
  scrollbar-width: none;
  &::-webkit-scrollbar {
    width: 0;
  }
`;

const GhostRowContainer = styled('div')`
  display: flex;
  width: 100%;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: -1;
`;

const TableItemsContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  display: flex;
  background: ${p => p.theme.background};
`;

const TableHeaderButton = styled('button')`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)};
  border: none;
  background-color: ${props => props.theme.surface100};
  transition: background-color 100ms ease-in-out;
  line-height: 24px;

  &:hover {
    background-color: ${props => props.theme.surface400};
  }

  svg {
    width: 10px;
    height: 10px;
  }
`;

const FrameBar = styled('div')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface100};
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

const FrameWeightsContainer = styled('div')`
  height: 100%;
  position: relative;
  scrollbar-width: none;
`;

const FrameWeightsRow = styled('div')`
  display: flex;
  left: 0;
  width: ${2 * FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;

const FrameNameRowsContainer = styled('div')`
  position: relative;
`;

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
