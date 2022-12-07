import {useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useSpanHandlers from 'sentry/utils/replays/hooks/useSpanHandlers';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import {COLUMNS, ROW_HEIGHT} from 'sentry/views/replays/detail/network/utils';
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
  const {items: filteredItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const {handleSort, items, sortConfig} = useSortNetwork({items: filteredItems});

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useSpanHandlers(startTimestampMs);

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
  const {cache} = useVirtualizedGrid({
    cellMeasurer: {
      fixedHeight: true,
    },
    ref: gridRef,
    deps: [items],
  });

  const renderTableCell = ({
    columnIndex,
    key,
    parent,
    rowIndex,
    style,
  }: GridCellProps) => {
    // Account for the header row in the rendered grid.
    const row = rowIndex - 1;

    const span = items[row] as NetworkSpan | undefined;

    const cellContent =
      rowIndex === 0 ? (
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
          hasOccurred={
            sortConfig.by === 'startTimestamp'
              ? currentTime >=
                relativeTimeInMs(span!.startTimestamp * 1000, startTimestampMs)
              : undefined
          }
          hasOccurredDesc={sortConfig.by === 'startTimestamp' && !sortConfig.asc}
          isCurrent={span!.id === current?.id}
          isHovered={span!.id === hovered?.id}
          span={span!}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      );

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {cellContent}
      </CellMeasurer>
    );
  };

  return (
    <NetworkContainer>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTableContainer>
        {networkSpans ? (
          <AutoSizer
            onResize={() => {
              cache.clearAll();
              gridRef.current?.recomputeGridSize({columnIndex: 1});
            }}
          >
            {({width, height}) => (
              <MultiGrid
                ref={gridRef}
                cellRenderer={renderTableCell}
                columnCount={COLUMNS.length}
                columnWidth={({index}) =>
                  index === 1
                    ? Math.max(
                        COLUMNS.reduce(
                          (remaining, _, i) =>
                            i === 1
                              ? remaining
                              : remaining - cache.columnWidth({index: i}),
                          width - scrollBarWidth
                        ),
                        200
                      )
                    : cache.columnWidth({index})
                }
                deferredMeasurementCache={cache}
                fixedRowCount={1}
                height={height}
                noContentRenderer={() => (
                  <NoRowRenderer
                    clearSearchTerm={clearSearchTerm}
                    unfilteredItems={networkSpans}
                  >
                    {t('No network requests recorded')}
                  </NoRowRenderer>
                )}
                onScrollbarPresenceChange={({vertical, size}) => {
                  setScrollBarWidth(vertical ? size : 0);
                }}
                overscanRowCount={5}
                rowCount={items.length + 1}
                rowHeight={({index}) =>
                  index === 0 ? ROW_HEIGHT.header : ROW_HEIGHT.body
                }
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </NetworkTableContainer>
    </NetworkContainer>
  );
}

const NetworkContainer = styled(FluidHeight)`
  height: 100%;
`;

const NetworkTableContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default NetworkList;
