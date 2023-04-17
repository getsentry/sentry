import styled from '@emotion/styled';

import {tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {useTransactionData} from 'sentry/views/replays/detail/transactions/replayTransactionContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord;
};

function TransactionsTable({replayRecord: _}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {state, eventView} = useTransactionData();

  const loading =
    state.requests !== state.responses ? (
      <LoadingCount>{tct('Loaded [responses] of [requests]', state)}</LoadingCount>
    ) : null;

  return (
    <FluidHeight>
      <TraceView
        meta={null}
        traces={state.traces ?? null}
        location={location}
        organization={organization}
        traceEventView={eventView!}
        traceSlug="Replay"
      />
      {loading}
    </FluidHeight>
  );
}

const LoadingCount = styled('div')`
  position: absolute;
  bottom: 0;
  right: 0;
  background: red;
`;

export default TransactionsTable;
