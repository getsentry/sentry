import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
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
import {relativeWeight} from 'sentry/utils/profiling/units/units';

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
  makeCallTreeTableSortFunction,
  syncCallTreeTableScroll,
} from '../callTreeTable';

import {FlamegraphTreeContextMenu} from './flamegraphTreeContextMenu';

function skipRecursiveNodes(n: VirtualizedTreeNode<FlamegraphFrame>): boolean {
  return n.node.node.isDirectRecursive();
}

interface FlamegraphTreeTableProps {
  canvasPoolManager: CanvasPoolManager;
  canvasScheduler: CanvasScheduler;
  flamegraph: Flamegraph;
  formatDuration: Flamegraph['formatter'];
  getFrameColor: (frame: FlamegraphFrame) => string;
  onBottomUpClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
  onTopDownClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
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
  recursion,
  flamegraph,
  onBottomUpClick,
  onTopDownClick,
}: FlamegraphTreeTableProps) {
  const [scrollContainerRef, setFixedScrollContainerRef] =
    useState<HTMLDivElement | null>(null);
  const [dynamicScrollContainerRef, setDynamicScrollContainerRef] =
    useState<HTMLDivElement | null>(null);

  const [sort, setSort] = useState<'total weight' | 'self weight' | 'name'>(
    'total weight'
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeCallTreeTableSortFunction(sort, direction);
  }, [sort, direction]);

  const [clickedContextMenuNode, setClickedContextMenuNode] =
    useState<VirtualizedTreeNode<FlamegraphFrame> | null>(null);

  const [tableParentContainer, setTableParentContainer] = useState<HTMLDivElement | null>(
    null
  );
  const contextMenu = useContextMenu({container: tableParentContainer});

  const onRowContextMenu = useCallback(
    (item: VirtualizedTreeNode<FlamegraphFrame>) => {
      return (e: React.MouseEvent<Element, MouseEvent>) => {
        setClickedContextMenuNode(item);
        contextMenu.handleContextMenu(e);
      };
    },
    [contextMenu]
  );

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

  const onHighlightAllOccurrencesClick = useCallback(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('highlight frame', [
      flamegraph.findAllMatchingFrames(
        clickedContextMenuNode.node.frame.name,
        clickedContextMenuNode.node.frame.package ??
          clickedContextMenuNode.node.frame.module ??
          ''
      ),
      'selected',
    ]);
  }, [canvasPoolManager, clickedContextMenuNode, flamegraph]);

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
            onContextMenu={onRowContextMenu(r.item)}
          >
            <CallTreeTableFixedColumns
              node={r.item}
              type="time"
              referenceNode={referenceNode}
              totalWeight={r.item.node.node.totalWeight}
              selfWeight={r.item.node.node.selfWeight}
              relativeSelfWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.selfWeight
              )}
              relativeTotalWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.totalWeight
              )}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, onRowContextMenu]
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
            onContextMenu={onRowContextMenu(r.item)}
          >
            <CallTreeTableDynamicColumns
              node={r.item}
              type="time"
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, onRowContextMenu]
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
  });

  const onSortChange = useCallback(
    (newSort: 'total weight' | 'self weight' | 'name') => {
      const newDirection =
        newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

      setDirection(newDirection);
      setSort(newSort);

      const sortFn = makeCallTreeTableSortFunction(newSort, newDirection);
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

  return (
    <FrameBar>
      <CallTreeTable>
        <CallTreeTableHeader>
          <FrameWeightCell>
            <CallTreeTableHeaderButton onClick={() => onSortChange('self weight')}>
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
            </CallTreeTableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <CallTreeTableHeaderButton onClick={() => onSortChange('total weight')}>
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
            </CallTreeTableHeaderButton>
          </FrameWeightCell>
          <div>
            <CallTreeTableHeaderButton onClick={() => onSortChange('name')}>
              <InteractionStateLayer />
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </CallTreeTableHeaderButton>
          </div>
        </CallTreeTableHeader>
        <CallTreeTableContainer ref={setTableParentContainer}>
          <FlamegraphTreeContextMenu
            onZoomIntoFrameClick={handleZoomIntoFrameClick}
            onHighlightAllFramesClick={onHighlightAllOccurrencesClick}
            contextMenu={contextMenu}
            onBottomUpClick={onBottomUpClick}
            onTopDownClick={onTopDownClick}
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
