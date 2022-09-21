import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

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
import {ColorOrAlias} from 'sentry/utils/theme';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import {
  getResourceTypes,
  getStatusTypes,
  ISortConfig,
  NetworkSpan,
  sortNetwork,
} from 'sentry/views/replays/detail/network/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  networkSpans: NetworkSpan[];
  replayRecord: ReplayRecord;
};

type SortDirection = 'asc' | 'desc';

const createSpanId = (span: NetworkSpan) =>
  `${span.description ?? span.op}-${span.startTimestamp}-${span.endTimestamp}`;

function NetworkList({replayRecord, networkSpans}: Props) {
  const startTimestampMs = replayRecord.startedAt.getTime();
  const {setCurrentHoverTime, setCurrentTime, currentTime} = useReplayContext();
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
  });

  const {
    items,
    status: selectedStatus,
    type: selectedType,
    searchTerm,
    setStatus,
    setType,
    setSearchTerm,
  } = useNetworkFilters({networkSpans});

  const currentNetworkSpan = getPrevReplayEvent({
    items: items.map(span => ({
      ...span,
      id: createSpanId(span),
      timestamp: span.startTimestamp * 1000,
    })),
    targetTimestampMs: startTimestampMs + currentTime,
  });

  const handleSearch = useMemo(() => debounce(query => setSearchTerm(query), 150), []);

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

  const renderTableRow = (network: NetworkSpan) => {
    const spanId = createSpanId(network);
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;
    const statusCode = network.data.statusCode;

    const columnHandlers = getColumnHandlers(networkStartTimestamp);
    const columnProps = {
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      isCurrent: currentNetworkSpan?.id === spanId,
      hasOccurred:
        currentTime >= relativeTimeInMs(networkStartTimestamp, startTimestampMs),
      timestampSort:
        sortConfig.by === 'startTimestamp'
          ? ((sortConfig.asc ? 'asc' : 'desc') as SortDirection)
          : undefined,
    };

    return (
      <Fragment key={spanId}>
        <Item {...columnHandlers} {...columnProps} isStatusCode>
          {statusCode ? statusCode : <EmptyText>---</EmptyText>}
        </Item>
        <Item {...columnHandlers} {...columnProps}>
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
        </Item>
        <Item {...columnHandlers} {...columnProps}>
          <Text>{network.op.replace('resource.', '')}</Text>
        </Item>
        <Item {...columnHandlers} {...columnProps} numeric>
          {defined(network.data.size) ? (
            <FileSize bytes={network.data.size} />
          ) : (
            <EmptyText>({t('Missing')})</EmptyText>
          )}
        </Item>

        <Item {...columnHandlers} {...columnProps} numeric>
          {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
        </Item>
        <Item {...columnHandlers} {...columnProps} numeric>
          <UnstyledButton onClick={() => handleClick(networkStartTimestamp)}>
            {showPlayerTime(networkStartTimestamp, startTimestampMs, true)}
          </UnstyledButton>
        </Item>
      </Fragment>
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
      <StyledPanelTable
        columns={columns.length}
        isEmpty={items.length === 0}
        emptyMessage={t('No related network requests found.')}
        headers={columns}
        disablePadding
        stickyHeaders
      >
        {items.map(renderTableRow) || null}
      </StyledPanelTable>
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

const Item = styled('div')<{
  center?: boolean;
  color?: ColorOrAlias;
  hasOccurred?: boolean;
  isCurrent?: boolean;
  isStatusCode?: boolean;
  isStatusError?: boolean;
  numeric?: boolean;
  timestampSort?: SortDirection;
}>`
  display: flex;
  align-items: center;
  ${p => p.center && 'justify-content: center;'}
  max-height: 28px;
  color: ${({hasOccurred = true, isStatusError, timestampSort, ...p}) => {
    if (hasOccurred || !timestampSort) {
      return isStatusError ? p.theme.red400 : p.theme.gray400;
    }
    return p.theme.gray300;
  }};
  padding: ${space(0.75)} ${space(1.5)};
  background-color: ${p => p.theme.background};
  border-bottom: ${({isCurrent = false, isStatusError, timestampSort, ...p}) => {
    if (isCurrent && timestampSort === 'asc') {
      return `1px solid ${p.theme.purple300} !important`;
    }
    return isStatusError
      ? `1px solid ${p.theme.red100}`
      : `1px solid ${p.theme.innerBorder}`;
  }};

  border-top: ${({isCurrent = false, timestampSort, ...p}) => {
    if (isCurrent && timestampSort === 'desc') {
      return `1px solid ${p.theme.purple300} !important`;
    }
    return 0;
  }};

  ${p => p.numeric && 'font-variant-numeric: tabular-nums;'};

  ${EmptyText} {
    color: ${({hasOccurred = true, timestampSort, ...p}) => {
      if (hasOccurred || !timestampSort) {
        return p.theme.gray400;
      }
      return p.theme.gray300;
    }};
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
  overflow: auto;

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

const SortItem = styled('span')`
  padding: ${space(0.5)} ${space(1.5)};
  width: 100%;

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkList;
