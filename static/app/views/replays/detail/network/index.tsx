import {useEffect, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  GridCellProps,
  MultiGrid,
} from 'react-virtualized';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell, {
  COLUMN_COUNT,
  HEADER_HEIGHT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  networkSpans: undefined | NetworkSpan[];
  startTimestampMs: number;
};

type SortDirection = 'asc' | 'desc';

const cache = new CellMeasurerCache({
  defaultWidth: 100,
  fixedHeight: true,
});

function NetworkList({networkSpans, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const [scrollBarWidth, setScrollBarWidth] = useState(0);
  const multiGridRef = useRef<MultiGrid>(null);
  const networkTableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let observer: ResizeObserver | null;

    if (networkTableRef.current) {
      // Observe the network table for width changes
      observer = new ResizeObserver(() => {
        // Recompute the column widths
        multiGridRef.current?.recomputeGridSize({columnIndex: 1});
      });

      observer.observe(networkTableRef.current);
    }

    return () => {
      observer?.disconnect();
    };
  }, [networkTableRef, searchTerm]);

  const getNetworkColumnValue = (network: NetworkSpan, column: number) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;
    const statusCode = network.data.statusCode;

    const columnProps = {
      onMouseEnter: () => handleMouseEnter(network),
      onMouseLeave: () => handleMouseLeave(network),
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      isCurrent: network.id === current?.id,
      isHovered: network.id === hovered?.id,
      hasOccurred:
        currentTime >= relativeTimeInMs(networkStartTimestamp, startTimestampMs),
      timestampSortDir:
        sortConfig.by === 'startTimestamp'
          ? ((sortConfig.asc ? 'asc' : 'desc') as SortDirection)
          : undefined,
    };

    const columnValues = [
      <Item key="statusCode" {...columnProps}>
        {statusCode ? statusCode : <EmptyText>---</EmptyText>}
      </Item>,
      <Item key="description" {...columnProps}>
        {network.description ? (
          <Tooltip
            title={network.description}
            isHoverable
            overlayStyle={{
              maxWidth: '500px !important',
            }}
            showOnlyOnOverflow
          >
            <Text>{network.description}</Text>
          </Tooltip>
        ) : (
          <EmptyText>({t('No value')})</EmptyText>
        )}
      </Item>,
      <Item key="type" {...columnProps}>
        <Tooltip
          title={network.op.replace('resource.', '')}
          isHoverable
          overlayStyle={{
            maxWidth: '500px !important',
          }}
          showOnlyOnOverflow
        >
          <Text>{network.op.replace('resource.', '')}</Text>
        </Tooltip>
      </Item>,
      <Item key="size" {...columnProps} numeric>
        {defined(network.data.size) ? (
          <FileSize bytes={network.data.size} />
        ) : (
          <EmptyText>({t('No value')})</EmptyText>
        )}
      </Item>,
      <Item key="duration" {...columnProps} numeric>
        {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
      </Item>,
      <Item key="timestamp" {...columnProps} numeric>
        <TimestampButton
          format="mm:ss.SSS"
          onClick={() => handleClick(network)}
          startTimestampMs={startTimestampMs}
          timestampMs={networkStartTimestamp}
        />
      </Item>,
    ];

    return columnValues[column];
  };

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
        <div key={key} style={style}>
          {rowIndex === 0 ? (
            <NetworkHeaderCell
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
            />
          ) : (
            getNetworkColumnValue(network, columnIndex)
          )}
        </div>
      </CellMeasurer>
    );
  };

  return (
    <NetworkContainer>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTable ref={networkTableRef}>
        {networkSpans ? (
          <AutoSizer>
            {({width, height}) => (
              <MultiGrid
                ref={multiGridRef}
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
                deferredMeasurementCache={cache}
                height={height}
                overscanRowCount={5}
                cellRenderer={renderTableRow}
                rowCount={items.length + 1}
                rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : 28)}
                width={width}
                fixedRowCount={1}
                onScrollbarPresenceChange={({vertical, size}) => {
                  if (vertical) {
                    setScrollBarWidth(size);
                  } else {
                    setScrollBarWidth(0);
                  }
                }}
                noContentRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={networkSpans}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No network requests recorded')}
                  </NoRowRenderer>
                )}
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

const Text = styled('p')`
  padding: 0;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const EmptyText = styled(Text)`
  font-style: italic;
  color: ${p => p.theme.subText};
`;

const fontColor = p =>
  p.isStatusError
    ? p.theme.alert.error.iconColor
    : p.hasOccurred
    ? 'inherit'
    : p.theme.gray300;

const Item = styled('div')<{
  hasOccurred: boolean;
  isCurrent: boolean;
  isHovered: boolean;
  isStatusError: boolean;
  timestampSortDir: SortDirection | undefined;
  numeric?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} ${space(1.5)};

  font-size: ${p => p.theme.fontSizeSmall};
  max-height: 28px;
  font-variant-numeric: tabular-nums;
  ${p => (p.numeric ? 'justify-content: flex-end;' : '')};

  background-color: ${p =>
    p.isStatusError ? p.theme.alert.error.backgroundLight : 'inherit'};

  border-bottom: 1px solid
    ${p =>
      p.timestampSortDir === 'asc'
        ? p.isCurrent
          ? p.theme.purple300
          : p.isHovered
          ? p.theme.purple200
          : 'transparent'
        : 'transparent'};

  border-top: 1px solid
    ${p =>
      p.timestampSortDir === 'desc'
        ? p.isCurrent
          ? p.theme.purple300
          : p.isHovered
          ? p.theme.purple200
          : 'transparent'
        : 'transparent'};

  color: ${fontColor};

  ${EmptyText} {
    color: ${fontColor};
  }
`;

const NetworkTable = styled('div')`
  list-style: none;
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding-left: 0;
  margin-bottom: 0;
`;

export default NetworkList;
