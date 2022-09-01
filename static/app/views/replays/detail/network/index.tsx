import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

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
import {ColorOrAlias} from 'sentry/utils/theme';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {
  getResourceTypes,
  getStatusTypes,
  ISortConfig,
  NetworkSpan,
  sortNetwork,
  UNKNOWN_STATUS,
} from 'sentry/views/replays/detail/network/utils';
import {Filters, getFilteredItems} from 'sentry/views/replays/detail/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  networkSpans: NetworkSpan[];
  replayRecord: ReplayRecord;
};

enum FilterTypesEnum {
  RESOURCE_TYPE = 'resourceType',
  STATUS = 'status',
}

function NetworkList({replayRecord, networkSpans}: Props) {
  const startTimestampMs = replayRecord.startedAt.getTime();
  const {setCurrentHoverTime, setCurrentTime} = useReplayContext();
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters<NetworkSpan>>({});

  const filteredNetworkSpans = useMemo(
    () =>
      getFilteredItems({
        items: networkSpans,
        filters,
        searchTerm,
        searchProp: 'description',
      }),
    [filters, networkSpans, searchTerm]
  );

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

  const networkData = useMemo(
    () => sortNetwork(filteredNetworkSpans, sortConfig),
    [filteredNetworkSpans, sortConfig]
  );

  const sortArrow = (sortedBy: string) => {
    return sortConfig.by === sortedBy ? (
      <IconArrow
        color="gray300"
        size="xs"
        direction={sortConfig.by === sortedBy && !sortConfig.asc ? 'up' : 'down'}
      />
    ) : null;
  };

  const handleFilters = useCallback(
    (
      selectedValues: (string | number)[],
      key: string,
      filter: (network: NetworkSpan) => boolean
    ) => {
      const filtersCopy = {...filters};

      if (selectedValues.length === 0) {
        delete filtersCopy[key];
        setFilters(filtersCopy);
        return;
      }

      setFilters({
        ...filters,
        [key]: filter,
      });
    },
    [filters]
  );

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

  const renderTableRow = (network: NetworkSpan, index: number) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;

    const columnHandlers = getColumnHandlers(networkStartTimestamp);

    return (
      <Fragment key={index}>
        <Item {...columnHandlers}>
          {network.data.statusCode ? network.data.statusCode : <EmptyText>---</EmptyText>}
        </Item>
        <Item {...columnHandlers}>
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
            <EmptyText>({t('Missing path')})</EmptyText>
          )}
        </Item>
        <Item {...columnHandlers}>
          <Text>{network.op.replace('resource.', '')}</Text>
        </Item>
        <Item {...columnHandlers} numeric>
          {defined(network.data.size) ? (
            <FileSize bytes={network.data.size} />
          ) : (
            <EmptyText>({t('Missing size')})</EmptyText>
          )}
        </Item>

        <Item {...columnHandlers} numeric>
          {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
        </Item>
        <Item {...columnHandlers} numeric>
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
          triggerProps={{
            prefix: t('Resource Type'),
          }}
          triggerLabel={!filters[FilterTypesEnum.RESOURCE_TYPE] ? t('Any') : null}
          multiple
          options={getResourceTypes(networkSpans).map(networkSpanResourceType => ({
            value: networkSpanResourceType,
            label: networkSpanResourceType,
          }))}
          size="sm"
          onChange={selections => {
            const selectedValues = selections.map(selection => selection.value);

            handleFilters(
              selectedValues,
              FilterTypesEnum.RESOURCE_TYPE,
              (networkSpan: NetworkSpan) => {
                return selectedValues.includes(networkSpan.op.replace('resource.', ''));
              }
            );
          }}
        />
        <CompactSelect
          triggerProps={{
            prefix: t('Status'),
          }}
          triggerLabel={!filters[FilterTypesEnum.STATUS] ? t('Any') : null}
          multiple
          options={getStatusTypes(networkSpans).map(networkSpanStatusType => ({
            value: networkSpanStatusType,
            label: networkSpanStatusType,
          }))}
          size="sm"
          onChange={selections => {
            const selectedValues = selections.map(selection => selection.value);

            handleFilters(
              selectedValues,
              FilterTypesEnum.STATUS,
              (networkSpan: NetworkSpan) => {
                if (
                  selectedValues.includes(UNKNOWN_STATUS) &&
                  !defined(networkSpan.data.statusCode)
                ) {
                  return true;
                }

                return selectedValues.includes(networkSpan.data.statusCode);
              }
            );
          }}
        />
        <SearchBar
          size="sm"
          onChange={handleSearch}
          placeholder={t('Search Network...')}
        />
      </NetworkFilters>
      <StyledPanelTable
        columns={columns.length}
        isEmpty={networkData.length === 0}
        emptyMessage={t('No related network requests found.')}
        headers={columns}
        disablePadding
        stickyHeaders
      >
        {networkData.map(renderTableRow) || null}
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

const Item = styled('div')<{center?: boolean; color?: ColorOrAlias; numeric?: boolean}>`
  display: flex;
  align-items: center;
  ${p => p.center && 'justify-content: center;'}
  max-height: 28px;
  color: ${p => p.theme[p.color || 'subText']};
  padding: ${space(0.75)} ${space(1.5)};
  background-color: ${p => p.theme.background};

  ${p => p.numeric && 'font-variant-numeric: tabular-nums;'}
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
  grid-template-columns: max-content minmax(200px, 1fr) repeat(
      4,
      minmax(max-content, 160px)
    );
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

  ${/* sc-selector */ PanelTableHeader} {
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

const SortItem = styled('span')`
  padding: ${space(0.5)} ${space(1.5)};
  width: 100%;

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkList;
