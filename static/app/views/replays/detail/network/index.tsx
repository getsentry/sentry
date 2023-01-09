import {useRef, useState} from 'react';
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
  HEADER_HEIGHT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import type {NetworkSpan} from 'sentry/views/replays/types';

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

  const [scrollBarWidth, setScrollBarWidth] = useState(0);
  const gridRef = useRef<MultiGrid>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const {cache} = useVirtualizedGrid({
    cellMeasurer: {
      defaultWidth: 100,
      fixedHeight: true,
    },
    ref: gridRef,
    wrapperRef: tableRef,
    deps: [items, searchTerm],
  });

  const renderTableRow = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const network = items[rowIndex - 1];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {rowIndex === 0 ? (
          <NetworkHeaderCell
            handleSort={handleSort}
            index={columnIndex}
            sortConfig={sortConfig}
            style={style}
          />
        ) : (
          <NetworkTableCell
            columnIndex={columnIndex}
            handleClick={handleClick}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
            isCurrent={network.id === current?.id}
            isHovered={network.id === hovered?.id}
            sortConfig={sortConfig}
            span={network}
            startTimestampMs={startTimestampMs}
            style={style}
          />
        )}
      </CellMeasurer>
    );
  };

  return (
    <NetworkContainer>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTable ref={tableRef}>
        {networkSpans ? (
          <AutoSizer>
            {({width, height}) => (
              <MultiGrid
                ref={gridRef}
                columnCount={COLUMN_COUNT}
                columnWidth={({index}) => {
                  if (index === 1) {
                    return Math.max(
                      Array.from(new Array(COLUMN_COUNT)).reduce(
                        (remaining, _, i) =>
                          i === 1 ? remaining : remaining - cache.columnWidth({index: i}),
                        width - scrollBarWidth
                      ),
                      200
                    );
                  }

                  return cache.columnWidth({index});
                }}
                cellRenderer={renderTableRow}
                deferredMeasurementCache={cache}
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
                onScrollbarPresenceChange={({vertical, size}) =>
                  setScrollBarWidth(vertical ? size : 0)
                }
                overscanColumnCount={COLUMN_COUNT}
                overscanRowCount={5}
                rowCount={items.length + 1}
                rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : 28)}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </NetworkTable>
    </NetworkContainer>
  );
}

const NetworkContainer = styled(FluidHeight)`
  height: 100%;
`;

const NetworkTable = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default NetworkList;
