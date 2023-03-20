import {useRef} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import type {NetworkSpan} from 'sentry/views/replays/types';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 28;

type Props = {
  networkSpans: undefined | NetworkSpan[];
  startTimestampMs: number;
};

function NetworkList({networkSpans, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortNetwork({items: filteredItems});

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const current = getPrevReplayEvent({
    items,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const hovered = currentHoverTime
    ? getPrevReplayEvent({
        items,
        targetTimestampMs: startTimestampMs + currentHoverTime,
        allowEqual: true,
        allowExact: true,
      })
    : null;

  const gridRef = useRef<MultiGrid>(null);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer: {
        defaultHeight: BODY_HEIGHT,
        defaultWidth: 100,
        fixedHeight: true,
      },
      gridRef,
      columnCount: COLUMN_COUNT,
      dynamicColumnIndex: 1,
      deps: [items, searchTerm],
    });

  const cellRenderer = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const network = items[rowIndex - 1];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {({
          measure: _,
          registerChild,
        }: {
          measure: () => void;
          registerChild?: (element?: Element) => void;
        }) =>
          rowIndex === 0 ? (
            <NetworkHeaderCell
              ref={e => e && registerChild?.(e)}
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
              style={{...style, height: HEADER_HEIGHT}}
            />
          ) : (
            <NetworkTableCell
              ref={e => e && registerChild?.(e)}
              columnIndex={columnIndex}
              handleClick={handleClick}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              isCurrent={network.id === current?.id}
              isHovered={network.id === hovered?.id}
              sortConfig={sortConfig}
              span={network}
              startTimestampMs={startTimestampMs}
              style={{...style, height: BODY_HEIGHT}}
            />
          )
        }
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTable>
        {networkSpans ? (
          <AutoSizer onResize={onWrapperResize}>
            {({width, height}) => (
              <MultiGrid
                ref={gridRef}
                cellRenderer={cellRenderer}
                columnCount={COLUMN_COUNT}
                columnWidth={getColumnWidth(width)}
                estimatedColumnSize={width}
                estimatedRowSize={HEADER_HEIGHT + items.length * BODY_HEIGHT}
                fixedRowCount={1}
                height={height}
                noContentRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={networkSpans}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No network requests recorded')}
                  </NoRowRenderer>
                )}
                onScrollbarPresenceChange={onScrollbarPresenceChange}
                overscanColumnCount={COLUMN_COUNT}
                overscanRowCount={5}
                rowCount={items.length + 1}
                rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : BODY_HEIGHT)}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </NetworkTable>
    </FluidHeight>
  );
}

const NetworkTable = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default NetworkList;
