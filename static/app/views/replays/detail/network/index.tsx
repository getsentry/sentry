import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventTransaction} from 'sentry/types';
import theme from 'sentry/utils/theme';

import {ISortConfig, NetworkSpan, sortNetwork} from './utils';

type Props = {
  event: EventTransaction;
  networkSpans: NetworkSpan[];
};

function NetworkList({event, networkSpans}: Props) {
  const {startTimestamp} = event;
  const [sortConfig, setSortConfig] = useState<ISortConfig>({
    by: 'startTimestamp',
    asc: true,
  });

  const handleSort = useCallback(
    (heading: typeof sortConfig.by) => {
      setSortConfig(prevSort => {
        if (prevSort.by === heading) {
          return {by: heading, asc: !prevSort.asc};
        }

        return {by: heading, asc: true};
      });
    },
    [sortConfig]
  );

  const networkData = useMemo(
    () => sortNetwork(networkSpans, sortConfig),
    [networkSpans, sortConfig]
  );

  const columns = [
    t('status'),
    t('path'),
    t('type'),
    t('duration'),
    <SortItem key="timestamp" onClick={() => handleSort('startTimestamp')}>
      {t('timestamp')}{' '}
      <IconArrow
        color="gray300"
        size="xs"
        direction={sortConfig.by === 'startTimestamp' && sortConfig.asc ? 'down' : 'up'}
      />
    </SortItem>,
  ];

  const renderTableRow = (network: NetworkSpan, index: number) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;

    return (
      <Fragment key={index}>
        <Item>{<StatusPlaceHolder height="20px" />}</Item>
        <Item color={theme.gray400}>
          <Text>{network.description || <Placeholder height="24px" />}</Text>
        </Item>
        <Item>
          <Text>{network.op}</Text>
        </Item>
        <Item numeric>
          {`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}
        </Item>
        <Item numeric>{showPlayerTime(networkStartTimestamp, startTimestamp)}</Item>
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
    >
      {networkData.map(renderTableRow) || null}
    </StyledPanelTable>
  );
}

const Item = styled('div')<{color?: string; numeric?: boolean}>`
  display: flex;
  align-items: center;
  max-height: 28px;
  color: ${p => p.color || p.theme.subText};
  border-radius: 0;
  padding: ${space(0.75)} ${space(1.5)};
  background-color: ${p => p.theme.background};
  line-height: 1;
  min-width: 0;

  ${p => p.numeric && 'font-variant-numeric: tabular-nums;'}

  /* Make odd rows have different background colors */
  &:nth-child(10n + 5),
  &:nth-child(10n + 4),
  &:nth-child(10n + 3),
  &:nth-child(10n + 2),
  &:nth-child(10n + 1) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: max-content minmax(200px, 1fr) repeat(3, max-content);
  font-size: ${p => p.theme.fontSizeSmall};

  > * {
    border-right: 1px solid ${p => p.theme.innerBorder};

    &:nth-last-child(n + ${p => p.columns + 1}) {
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }

    /* Last column */
    &:nth-child(${p => p.columns}n) {
      border-right: 0;
      text-align: right;
      justify-content: end;
    }
  }

  ${/* sc-selector */ PanelTableHeader} {
    min-height: 24px;
    padding: ${space(0.5)} ${space(1.5)};
    border-radius: 0;
    color: ${p => p.theme.subText};
  }

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const StatusPlaceHolder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.border};
  border-radius: 17px;
`;

const Text = styled('p')`
  padding: 0;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const SortItem = styled('span')`
  cursor: pointer;

  svg {
    vertical-align: top;
  }
`;

export default NetworkList;
