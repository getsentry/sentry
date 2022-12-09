import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  GridCellProps,
  MultiGrid,
} from 'react-virtualized';
import styled from '@emotion/styled';
import range from 'lodash/range';

import FileSize from 'sentry/components/fileSize';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
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
import type {NetworkSpan, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  networkSpans: undefined | NetworkSpan[];
  replayRecord: undefined | ReplayRecord;
};

type SortDirection = 'asc' | 'desc';

const cache = new CellMeasurerCache({
  defaultWidth: 100,
  fixedHeight: true,
});

function NetworkList({replayRecord, networkSpans}: Props) {
  const startTimestampMs = replayRecord?.startedAt?.getTime() || 0;
  const {setCurrentHoverTime, setCurrentTime, currentTime} = useReplayContext();

  const [scrollBarWidth, setScrollBarWidth] = useState(0);
  const multiGridRef = useRef<MultiGrid>(null);
  const networkTableRef = useRef<HTMLDivElement>(null);

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items: networkData, sortConfig} = useSortNetwork({items});

  const currentNetworkSpan = getPrevReplayEvent({
    items: networkData,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const handleMouseEnter = useCallback(
    (timestamp: number) => {
      if (startTimestampMs) {
        setCurrentHoverTime(relativeTimeInMs(timestamp, startTimestampMs));
      }
    },
    [setCurrentHoverTime, startTimestampMs]
  );

  const handleMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  const handleClick = useCallback(
    (timestamp: number) => {
      setCurrentTime(relativeTimeInMs(timestamp, startTimestampMs));
    },
    [setCurrentTime, startTimestampMs]
  );

  const getColumnHandlers = useCallback(
    (startTime: number) => ({
      onMouseEnter: () => handleMouseEnter(startTime),
      onMouseLeave: handleMouseLeave,
    }),
    [handleMouseEnter, handleMouseLeave]
  );

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

    const columnHandlers = getColumnHandlers(networkStartTimestamp);
    const columnProps = {
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      isCurrent: currentNetworkSpan?.id === network.id,
      hasOccurred:
        currentTime >= relativeTimeInMs(networkStartTimestamp, startTimestampMs),
      timestampSortDir:
        sortConfig.by === 'startTimestamp'
          ? ((sortConfig.asc ? 'asc' : 'desc') as SortDirection)
          : undefined,
    };

    const columnValues = [
      <Item key="statusCode" {...columnHandlers} {...columnProps}>
        {statusCode ? statusCode : <EmptyText>---</EmptyText>}
      </Item>,
      <Item key="description" {...columnHandlers} {...columnProps}>
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
      <Item key="type" {...columnHandlers} {...columnProps}>
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
      <Item key="size" {...columnHandlers} {...columnProps} numeric>
        {defined(network.data.size) ? (
          <FileSize bytes={network.data.size} />
        ) : (
          <EmptyText>({t('No value')})</EmptyText>
        )}
      </Item>,
      <Item key="duration" {...columnHandlers} {...columnProps} numeric>
        {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
      </Item>,
      <Item key="timestamp" {...columnHandlers} {...columnProps} numeric>
        <TimestampButton
          format="mm:ss.SSS"
          onClick={() => handleClick(networkStartTimestamp)}
          startTimestampMs={startTimestampMs}
          timestampMs={networkStartTimestamp}
        />
      </Item>,
    ];

    return columnValues[column];
  };

  const renderTableRow = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const network = networkData[rowIndex - 1];

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
                      range(COLUMN_COUNT).reduce(
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
                rowCount={networkData.length + 1}
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

const fontColor = p => {
  if (p.isStatusError) {
    return p.hasOccurred || !p.timestampSortDir ? p.theme.red400 : p.theme.red200;
  }
  return p.hasOccurred || !p.timestampSortDir ? p.theme.gray400 : p.theme.gray300;
};

const Item = styled('div')<{
  hasOccurred: boolean;
  isCurrent: boolean;
  isStatusError: boolean;
  timestampSortDir: SortDirection | undefined;
  numeric?: boolean;
}>`
  display: flex;
  align-items: center;

  font-size: ${p => p.theme.fontSizeSmall};
  max-height: 28px;
  color: ${fontColor};
  padding: ${space(0.75)} ${space(1.5)};
  background-color: ${p => p.theme.background};
  border-bottom: ${p => {
    if (p.isCurrent && p.timestampSortDir === 'asc') {
      return `1px solid ${p.theme.purple300} !important`;
    }
    return p.isStatusError
      ? `1px solid ${p.theme.red100}`
      : `1px solid ${p.theme.innerBorder}`;
  }};

  border-top: ${p => {
    return p.isCurrent && p.timestampSortDir === 'desc'
      ? `1px solid ${p.theme.purple300} !important`
      : 0;
  }};

  border-right: 1px solid ${p => p.theme.innerBorder};

  ${p => p.numeric && 'font-variant-numeric: tabular-nums; justify-content: flex-end;'};

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
