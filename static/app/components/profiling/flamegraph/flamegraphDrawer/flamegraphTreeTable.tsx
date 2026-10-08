import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';

import {
  CallTreeTable,
  CallTreeTableContainer,
  CallTreeTableFrameCell,
  CallTreeTableRow,
  CallTreeTableWeightCell,
  makeCallTreeTableSortFunction,
  useCallTreeTable,
} from 'sentry/components/profiling/flamegraph/callTreeTable';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {
  CanvasPoolManager,
  CanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {relativeWeight} from 'sentry/utils/profiling/units/units';

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
      return (e: React.MouseEvent) => {
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

  const {
    items: renderItems,
    rowCount,
    tableRef,
    handleSortingChange,
    handleScrollTo,
    handleExpandTreeNode,
    handleRowClick,
    getRowProps,
  } = useCallTreeTable({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    tree,
  });

  const onSortChange = (newSort: 'total weight' | 'self weight' | 'name') => {
    const newDirection =
      newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

    setDirection(newDirection);
    setSort(newSort);

    const sortFn = makeCallTreeTableSortFunction(newSort, newDirection);
    handleSortingChange(sortFn);
  };

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
    <FrameBar ref={setTableParentContainer}>
      <FlamegraphTreeContextMenu
        onZoomIntoFrameClick={handleZoomIntoFrameClick}
        onHighlightAllFramesClick={onHighlightAllOccurrencesClick}
        contextMenu={contextMenu}
        onBottomUpClick={onBottomUpClick}
        onTopDownClick={onTopDownClick}
      />
      <CallTreeTable
        ref={tableRef}
        items={renderItems}
        rowCount={rowCount}
        header={
          <Fragment>
            <SimpleTable.HeaderCell
              align="right"
              handleSortClick={() => onSortChange('self weight')}
              sort={sort === 'self weight' ? direction : undefined}
            >
              {t('Self Time')}{' '}
              <InfoTip
                title={t(
                  'Self time is the amount of time spent by this function excluding the time spent by other functions called within it.'
                )}
                size="sm"
                position="top"
              />
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell
              align="right"
              handleSortClick={() => onSortChange('total weight')}
              sort={sort === 'total weight' ? direction : undefined}
            >
              {t('Total Time')}{' '}
              <InfoTip
                title={t(
                  'Total time is the total amount of time spent by this function.'
                )}
                size="sm"
                position="top"
              />
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell
              handleSortClick={() => onSortChange('name')}
              sort={sort === 'name' ? direction : undefined}
            >
              {t('Frame')}
            </SimpleTable.HeaderCell>
          </Fragment>
        }
      >
        {renderItems.map(r => (
          <CallTreeTableRow
            key={r.key}
            {...getRowProps(r)}
            onClick={handleRowClick(r.key)}
            onContextMenu={onRowContextMenu(r.item)}
          >
            <CallTreeTableWeightCell
              relativeWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.selfWeight
              )}
            >
              {flamegraph.formatter(r.item.node.node.selfWeight)}
            </CallTreeTableWeightCell>
            <CallTreeTableWeightCell
              isApplicationFrame={r.item.node.node.frame.is_application}
              relativeWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.totalWeight
              )}
            >
              {flamegraph.formatter(r.item.node.node.totalWeight)}
            </CallTreeTableWeightCell>
            <CallTreeTableFrameCell
              frameColor={getFrameColor(r.item.node)}
              node={r.item}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        ))}
      </CallTreeTable>
    </FrameBar>
  );
}

const FrameBar = styled(CallTreeTableContainer)`
  grid-area: table;
`;
