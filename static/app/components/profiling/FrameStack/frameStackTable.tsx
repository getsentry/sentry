import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {
  UseVirtualizedListProps,
  useVirtualizedTree,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

import {FrameCallersTableCell} from './frameStack';
import {FrameStackContextMenu} from './frameStackContextMenu';
import {FrameStackTableRow} from './frameStackTableRow';

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

interface FrameStackTableProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
  recursion: 'collapsed' | null;
  referenceNode: FlamegraphFrame;
  roots: FlamegraphFrame[];
}

export function FrameStackTable({
  roots,
  flamegraphRenderer,
  canvasPoolManager,
  referenceNode,
  recursion,
}: FrameStackTableProps) {
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

    canvasPoolManager.dispatch('zoomIntoFrame', [clickedContextMenuNode.node, 'exact']);
  }, [canvasPoolManager, clickedContextMenuNode]);

  const renderRow: UseVirtualizedListProps<FlamegraphFrame>['renderRow'] = useCallback(
    (
      r,
      {
        handleRowClick,
        handleRowMouseEnter,
        handleExpandTreeNode,
        handleRowKeyDown,
        tabIndexKey,
      }
    ) => {
      return (
        <FrameStackTableRow
          ref={n => {
            r.ref = n;
          }}
          node={r.item}
          style={r.styles}
          referenceNode={referenceNode}
          tabIndex={tabIndexKey === r.key ? 0 : 1}
          flamegraphRenderer={flamegraphRenderer}
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
    [contextMenu, flamegraphRenderer, referenceNode]
  );

  const {
    renderedItems,
    scrollContainerStyles,
    containerStyles,
    handleSortingChange,
    clickedGhostRowRef,
    hoveredGhostRowRef,
  } = useVirtualizedTree({
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    renderRow,
    scrollContainer: scrollContainerRef,
    rowHeight: 24,
    roots,
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

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('self weight')}>
              {t('Self Time ')}
              {sort === 'self weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('total weight')}>
              {t('Total Time')}{' '}
              {sort === 'total weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameNameCell>
            <TableHeaderButton onClick={() => onSortChange('name')}>
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameNameCell>
        </FrameCallersTableHeader>
        <FrameStackContextMenu
          onZoomIntoFrameClick={handleZoomIntoFrameClick}
          contextMenu={contextMenu}
        />
        <TableItemsContainer>
          <div ref={clickedGhostRowRef} />
          <div ref={hoveredGhostRowRef} />
          <div
            ref={ref => setScrollContainerRef(ref)}
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
  background: ${p => p.theme.white};
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
  background-color: ${props => props.theme.surface400};
  transition: background-color 100ms ease-in-out;

  &:hover {
    background-color: #edecee;
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
