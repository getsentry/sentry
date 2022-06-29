import {Fragment} from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types';

type NetworkListProps = {
  event: EventTransaction;
  startTimestamp: number;
};

type NetworkSpan = {
  data: Record<string, any>;
  op: string;
  parent_span_id: string;
  span_id: string;
  start_timestamp: number;
  timestamp: number;
  description?: string | undefined;
};

const columns = [
  t('url'),
  t('type'),
  t('size'),
  t('start time'),
  t('duration'),
  t('response code'),
];

function NetworkList({event, startTimestamp}: NetworkListProps) {
  // TODO(replay): improve
  const data = event.entries[0].data as NetworkSpan[];

  const renderTableRow = (network: NetworkSpan) => {
    const networkStartTimestamp = network.start_timestamp * 1000;
    const networkEndTimestamp = network.timestamp * 1000;

    return (
      <Fragment key={network.span_id}>
        <Item>{network.description || <Placeholder height="24px" />}</Item>
        <Item>{network.op}</Item>
        <Item>{network.data?.size ?? 0}</Item>
        <Item>{showPlayerTime(networkStartTimestamp, startTimestamp)}</Item>
        <Item>{`${(networkEndTimestamp - networkStartTimestamp).toFixed(2)}ms`}</Item>
        <Item>{<Placeholder height="24px" />}</Item>
      </Fragment>
    );
  };

  return (
    <StyledPanelTable
      isEmpty={data.length === 0}
      emptyMessage={t('No related network requests found.')}
      headers={columns}
    >
      {data.map(renderTableRow) || null}
    </StyledPanelTable>
  );
}

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledPanelTable = styled(PanelTable)`
  /* overflow: visible allows the tooltip to be completely shown */
  overflow: visible;
  grid-template-columns: minmax(1fr, max-content) repeat(3, max-content);

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) repeat(2, max-content);
  }
`;

export default NetworkList;
