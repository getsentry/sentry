import {Fragment} from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types';

type NetworkSpan = {
  data: Record<string, any>;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  description?: string | undefined;
};

type Props = {
  event: EventTransaction;
  networkSpans: NetworkSpan[];
};

const columns = [
  t('url'),
  t('type'),
  t('size'),
  t('start time'),
  t('duration'),
  t('response code'),
];

function NetworkList({event, networkSpans}: Props) {
  const {startTimestamp} = event;

  const renderTableRow = (network: NetworkSpan, index: number) => {
    const networkStartTimestamp = network.startTimestamp * 1000;
    const networkEndTimestamp = network.endTimestamp * 1000;

    return (
      <Fragment key={index}>
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
      isEmpty={networkSpans.length === 0}
      emptyMessage={t('No related network requests found.')}
      headers={columns}
    >
      {networkSpans.map(renderTableRow) || null}
    </StyledPanelTable>
  );
}

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledPanelTable = styled(PanelTable)`
  overflow: scroll;
  word-break: break-word;
  grid-template-columns: minmax(200px, 1fr) repeat(5, max-content);

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

export default NetworkList;
