import {ComponentProps, useRef} from 'react';
import {AutoSizer} from 'react-virtualized';
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
import VirtualGrid from 'sentry/views/replays/detail/virtualGrid';
import type {NetworkSpan} from 'sentry/views/replays/types';

// import useVirtualGridMeasurements from '../useVirtualGridMeasurements';

type Props = {
  networkSpans: undefined | NetworkSpan[];
  startTimestampMs: number;
};

type ItemData = {
  current: ReturnType<typeof getPrevReplayEvent>;
  hovered: ReturnType<typeof getPrevReplayEvent>;
  startTimestampMs: Props['startTimestampMs'];
} & ReturnType<typeof useCrumbHandlers> &
  ReturnType<typeof useSortNetwork>;

const HeadCell: ComponentProps<typeof VirtualGrid>['headerRenderer'] = ({
  columnIndex,
  style,
  data,
}) => {
  const {handleSort, sortConfig} = data as ItemData;
  return (
    <NetworkHeaderCell
      handleSort={handleSort}
      index={columnIndex}
      sortConfig={sortConfig}
      style={style}
    />
  );
};

const BodyCell: ComponentProps<typeof VirtualGrid>['cellRenderer'] = ({
  columnIndex,
  rowIndex,
  style,
  data,
}) => {
  const {
    items,
    current,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    hovered,
    sortConfig,
    startTimestampMs,
  } = data as ItemData;
  const network = items[rowIndex];
  return (
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
  );
};

function NetworkList({networkSpans, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items: filteredItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const sortResult = useSortNetwork({items: filteredItems});
  const {items} = sortResult;

  const crumbHandlers = useCrumbHandlers(startTimestampMs);

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
    : undefined;

  const itemData = {
    current,
    hovered,
    startTimestampMs,
    ...sortResult,
    ...crumbHandlers,
  };

  // const {cellMeasurer, columnWidth, onResize, rowHeight, maxHeights, maxWidths} =
  //   useVirtualGridMeasurements({
  //     rowHeight: 28,
  //     widths: [100, 100, 100, 100, 100, 100],
  //   });
  // console.log('render table', {maxHeights, maxWidths});

  const grid = useRef<typeof VirtualGrid>(null);
  const onResize = () => {
    // @ts-expect-error
    grid.current?.resetAfterColumnIndex(1);
  };
  const cellMeasurer = c => c;
  const columnWidth = (fullWidth: number) => {
    const widths = [79, 0, 114, 60, 94, 102];

    return (index: number) => {
      if (widths[index]) {
        return widths[index];
      }
      const colWidth = widths.reduce((remaining, width) => remaining - width, fullWidth);
      return Math.max(colWidth, 200);
    };
  };
  const rowHeight = () => 28;

  return (
    <NetworkContainer>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTable>
        {networkSpans ? (
          <AutoSizer onResize={onResize}>
            {({width, height}) =>
              items.length ? (
                <VirtualGrid
                  ref={grid}
                  itemData={itemData}
                  cellRenderer={cellMeasurer(BodyCell)}
                  columnCount={COLUMN_COUNT}
                  columnWidth={columnWidth(width)}
                  headerHeight={25}
                  headerRenderer={HeadCell}
                  height={height}
                  rowCount={items.length}
                  rowHeight={rowHeight}
                  width={width}
                />
              ) : (
                <div style={{width, height}}>
                  <NoRowRenderer
                    unfilteredItems={networkSpans}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No network requests recorded')}
                  </NoRowRenderer>
                </div>
              )
            }
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
