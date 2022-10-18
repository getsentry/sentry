import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  Grid,
  GridCellProps,
  ScrollSync,
} from 'react-virtualized';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import FileSize from 'sentry/components/fileSize';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import SearchBar from 'sentry/components/searchBar';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import {
  getResourceTypes,
  getStatusTypes,
  ISortConfig,
  sortNetwork,
} from 'sentry/views/replays/detail/network/utils';
import type {NetworkSpan, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  networkSpans: NetworkSpan[];
  replayRecord: ReplayRecord;
};

type SortDirection = 'asc' | 'desc';

const cache = new CellMeasurerCache({
  defaultWidth: 100,
  fixedHeight: true,
});

const headerRowHeight = 24;

function NetworkList({replayRecord, networkSpans}: Props) {
  const startTimestampMs = replayRecord.startedAt.getTime();
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const {setCurrentHoverTime, setCurrentTime, currentTime} = useReplayContext();
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
  });
  const gridHeaderRef = useRef<Grid>(null);
  const gridRef = useRef<Grid>(null);

  const {
    items,
    status: selectedStatus,
    type: selectedType,
    searchTerm,
    setStatus,
    setType,
    setSearchTerm,
  } = useNetworkFilters({networkSpans});

  const networkData = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

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
    // Restart cache when items changes
    if (gridHeaderRef.current && gridRef.current) {
      cache.clearAll();
      gridHeaderRef.current.forceUpdate();
      gridRef.current.forceUpdate();
    }
  }, [sortConfig]);

  function handleSort(fieldName: keyof NetworkSpan): void;
  function handleSort(key: string, getValue: (row: NetworkSpan) => any): void;
  function handleSort(
    fieldName: string | keyof NetworkSpan,
    getValue?: (row: NetworkSpan) => any
  ) {
    const getValueFunction = getValue ? getValue : (row: NetworkSpan) => row[fieldName];

    setSortConfig(prevSort => {
      if (prevSort.by === fieldName) {
        return {by: fieldName, asc: !prevSort.asc, getValue: getValueFunction};
      }

      return {by: fieldName, asc: true, getValue: getValueFunction};
    });
  }

  const sortArrow = (sortedBy: string) => {
    return sortConfig.by === sortedBy ? (
      <IconArrow
        color="gray300"
        size="xs"
        direction={sortConfig.by === sortedBy && !sortConfig.asc ? 'down' : 'up'}
      />
    ) : null;
  };

  const columns = [
    <SortItem key="status">
      <UnstyledHeaderButton
        onClick={() => handleSort('status', row => row.data.statusCode)}
      >
        {t('Status')} {sortArrow('status')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="path">
      <UnstyledHeaderButton onClick={() => handleSort('description')}>
        {t('Path')} {sortArrow('description')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="type">
      <UnstyledHeaderButton onClick={() => handleSort('op')}>
        {t('Type')} {sortArrow('op')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="size">
      <UnstyledHeaderButton onClick={() => handleSort('size', row => row.data.size)}>
        {t('Size')} {sortArrow('size')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="duration">
      <UnstyledHeaderButton
        onClick={() =>
          handleSort('duration', row => {
            return row.endTimestamp - row.startTimestamp;
          })
        }
      >
        {t('Duration')} {sortArrow('duration')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="timestamp">
      <UnstyledHeaderButton onClick={() => handleSort('startTimestamp')}>
        {t('Timestamp')} {sortArrow('startTimestamp')}
      </UnstyledHeaderButton>
    </SortItem>,
  ];

  const renderTableHeader = ({
    columnIndex,
    key,
    style,
    parent,
    rowIndex,
  }: GridCellProps) => {
    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
        style={style}
      >
        <NetworkTableHeader key={key} style={style} columns={columns.length}>
          {columns[columnIndex]}
        </NetworkTableHeader>
      </CellMeasurer>
    );
  };

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
      <Item key="statusCode" {...columnHandlers} {...columnProps} isStatusCode>
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
          <EmptyText>({t('Missing')})</EmptyText>
        )}
      </Item>,
      <Item key="type" {...columnHandlers} {...columnProps}>
        <Text>{network.op.replace('resource.', '')}</Text>
      </Item>,
      <Item key="size" {...columnHandlers} {...columnProps} numeric>
        {defined(network.data.size) ? (
          <FileSize bytes={network.data.size} />
        ) : (
          <EmptyText>({t('Missing')})</EmptyText>
        )}
      </Item>,
      <Item key="duration" {...columnHandlers} {...columnProps} numeric>
        {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
      </Item>,
      <Item key="timestamp" {...columnHandlers} {...columnProps} numeric>
        <Tooltip title={<DateTime date={networkStartTimestamp} seconds />}>
          <UnstyledButton onClick={() => handleClick(networkStartTimestamp)}>
            {showPlayerTime(networkStartTimestamp, startTimestampMs, true)}
          </UnstyledButton>
        </Tooltip>
      </Item>,
    ];

    return columnValues[column];
  };

  const renderTableRow = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const network = networkData[rowIndex];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        <div
          style={{
            ...style,
            maxWidth: '100%',
          }}
        >
          {getNetworkColumnValue(network, columnIndex)}
        </div>
      </CellMeasurer>
    );
  };

  return (
    <NetworkContainer>
      <NetworkFilters>
        <CompactSelect
          triggerProps={{prefix: t('Status')}}
          triggerLabel={selectedStatus.length === 0 ? t('Any') : null}
          multiple
          options={getStatusTypes(networkSpans).map(value => ({value, label: value}))}
          size="sm"
          onChange={selected => setStatus(selected.map(_ => _.value))}
          value={selectedStatus}
        />
        <CompactSelect
          triggerProps={{prefix: t('Type')}}
          triggerLabel={selectedType.length === 0 ? t('Any') : null}
          multiple
          options={getResourceTypes(networkSpans).map(value => ({value, label: value}))}
          size="sm"
          onChange={selected => setType(selected.map(_ => _.value))}
          value={selectedType}
        />
        <SearchBar
          size="sm"
          onChange={setSearchTerm}
          placeholder={t('Search Network...')}
          query={searchTerm}
        />
      </NetworkFilters>
      {/* <StyledPanelTable
        columns={columns.length}
        isEmpty={networkData.length === 0}
        emptyMessage={t('No related network requests found.')}
        headers={columns}
        disablePadding
        stickyHeaders
      > */}
      {/* {networkData.map(renderTableRow)} */}
      <NetworkTable>
        <ScrollSync>
          {({onScroll, scrollLeft}) => (
            <AutoSizer>
              {({width, height}) => (
                <Fragment>
                  <Grid
                    ref={gridHeaderRef}
                    css={{
                      overflow: 'hidden !important',
                    }}
                    columnCount={columns.length}
                    columnWidth={cache.columnWidth}
                    deferredMeasurementCache={cache}
                    height={headerRowHeight}
                    overscanColumnCount={columns.length}
                    overscanRowCount={2}
                    cellRenderer={renderTableHeader}
                    rowCount={1}
                    rowHeight={24}
                    width={width - scrollbarSize}
                    scrollLeft={scrollLeft}
                  />
                  <Grid
                    ref={gridRef}
                    columnCount={columns.length}
                    columnWidth={cache.columnWidth}
                    deferredMeasurementCache={cache}
                    height={height - headerRowHeight}
                    overscanColumnCount={columns.length}
                    overscanRowCount={2}
                    cellRenderer={renderTableRow}
                    rowCount={networkData.length}
                    rowHeight={28}
                    width={width}
                    onScroll={onScroll}
                    onScrollbarPresenceChange={({size, vertical}) => {
                      if (vertical) {
                        setScrollbarSize(size);
                      } else {
                        setScrollbarSize(0);
                      }
                    }}
                  />
                </Fragment>
              )}
            </AutoSizer>
          )}
        </ScrollSync>
      </NetworkTable>
      {/* </StyledPanelTable> */}
    </NetworkContainer>
  );
}

const NetworkContainer = styled(FluidHeight)`
  height: 100%;
`;

const NetworkFilters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content max-content 1fr;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
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
  center?: boolean;
  isStatusCode?: boolean;
  numeric?: boolean;
}>`
  display: flex;
  align-items: center;
  ${p => p.center && 'justify-content: center;'}

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

  ${p => p.numeric && 'font-variant-numeric: tabular-nums;'};

  ${EmptyText} {
    color: ${fontColor};
  }
`;

const UnstyledButton = styled('button')`
  border: 0;
  background: none;
  padding: 0;
  text-transform: inherit;
  width: 100%;
  text-align: unset;
`;

const UnstyledHeaderButton = styled(UnstyledButton)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: max-content minmax(200px, 1fr) repeat(4, max-content);
  grid-template-rows: 24px repeat(auto-fit, 28px);
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  height: 100%;
  /* overflow: auto; */
  overflow: hidden;

  > * {
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-bottom: 1px solid ${p => p.theme.innerBorder};

    /* Last column */
    &:nth-child(${p => p.columns}n) {
      border-right: 0;
      text-align: right;
      justify-content: end;
    }

    /* 3rd and 2nd last column */
    &:nth-child(${p => p.columns}n - 1),
    &:nth-child(${p => p.columns}n - 2) {
      text-align: right;
      justify-content: end;
    }
  }

  ${PanelTableHeader} {
    min-height: 24px;
    border-radius: 0;
    color: ${p => p.theme.subText};
    line-height: 16px;
    text-transform: none;

    /* Last, 2nd and 3rd last header columns. As these are flex direction columns we have to treat them separately */
    &:nth-child(${p => p.columns}n),
    &:nth-child(${p => p.columns}n - 1),
    &:nth-child(${p => p.columns}n - 2) {
      justify-content: center;
      align-items: flex-start;
      text-align: start;
    }
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

const NetworkTableHeader = styled('div')<{columns: number}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  justify-content: center;

  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.initial};

  min-height: 24px;
  border-radius: 0;
  line-height: 16px;
  text-transform: none;

  border-right: 1px solid ${p => p.theme.innerBorder};
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  /* Last column */
  &:nth-child(${p => p.columns}n) {
    border-right: 0;
    text-align: right;
    justify-content: end;
  }

  /* 3rd and 2nd last column */
  &:nth-child(${p => p.columns}n - 1),
  &:nth-child(${p => p.columns}n - 2) {
    text-align: right;
    justify-content: end;
  }

  /* Last, 2nd and 3rd last header columns. As these are flex direction columns we have to treat them separately */
  &:nth-child(${p => p.columns}n),
  &:nth-child(${p => p.columns}n - 1),
  &:nth-child(${p => p.columns}n - 2) {
    justify-content: center;
    align-items: flex-start;
    text-align: start;
  }
`;

const SortItem = styled('span')`
  padding: ${space(0.5)} ${space(1.5)};
  width: 100%;

  display: flex;
  align-items: center;

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkList;
