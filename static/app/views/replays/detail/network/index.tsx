import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {ColorOrAlias} from 'sentry/utils/theme';
import {
  ISortConfig,
  NetworkSpan,
  sortNetwork,
} from 'sentry/views/replays/detail/network/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  networkSpans: NetworkSpan[];
  replayRecord: ReplayRecord;
};

function NetworkList({replayRecord, networkSpans}: Props) {
  const startTimestampMs = replayRecord.startedAt.getTime();
  const {setCurrentHoverTime, setCurrentTime} = useReplayContext();
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
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
    () => sortNetwork(networkSpans, sortConfig),
    [networkSpans, sortConfig]
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

  const columns = [
    <SortItem key="status">{t('Status')}</SortItem>,
    <SortItem key="path">
      <UnstyledButton onClick={() => handleSort('description')}>
        {t('Path')} {sortArrow('description')}
      </UnstyledButton>
    </SortItem>,
    <SortItem key="type">
      <UnstyledButton onClick={() => handleSort('op')}>
        {t('Type')} {sortArrow('op')}
      </UnstyledButton>
    </SortItem>,
    <SortItem key="size">
      <UnstyledButton onClick={() => handleSort('size', row => row.data.size)}>
        {t('Size')} {sortArrow('size')}
      </UnstyledButton>
    </SortItem>,
    <SortItem key="duration">
      <UnstyledButton
        onClick={() =>
          handleSort('duration', row => {
            return row.endTimestamp - row.startTimestamp;
          })
        }
      >
        {t('Duration')} {sortArrow('duration')}
      </UnstyledButton>
    </SortItem>,
    <SortItem key="timestamp">
      <UnstyledButton onClick={() => handleSort('startTimestamp')}>
        {t('Timestamp')} {sortArrow('startTimestamp')}
      </UnstyledButton>
    </SortItem>,
  ];

  const renderTableRow = (network: NetworkSpan, index: number) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;

    const columnHandlers = getColumnHandlers(networkStartTimestamp);

    return (
      <Fragment key={index}>
        <Item center {...columnHandlers}>
          <StatusPlaceHolder height="20px" />
        </Item>
        <Item color="gray400" {...columnHandlers}>
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
  );
}

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

  ${/* sc-selector */ PanelTableHeader} {
    min-height: 24px;
    border-radius: 0;
    color: ${p => p.theme.subText};
    line-height: 16px;

    /* Last, 2nd and 3rd last header columns. As these are flex direction columns we have to treat them separately */
    &:nth-child(${p => p.columns}n),
    &:nth-child(${p => p.columns}n - 1),
    &:nth-child(${p => p.columns}n - 2) {
      justify-content: center;
      align-items: end;
    }
  }
`;

const StatusPlaceHolder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.border};
  border-radius: 17px;
  max-width: 40px;
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
    vertical-align: text-top;
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

export default NetworkList;
