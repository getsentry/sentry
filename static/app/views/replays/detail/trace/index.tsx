import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {useTransactionData} from 'sentry/views/replays/detail/trace/replayTransactionContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: undefined | ReplayRecord;
};

function Transactions({replayRecord}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {state, eventView} = useTransactionData();

  if (!replayRecord || !state.traces?.length) {
    return <Placeholder height="100%" />;
  }

  const loading =
    state.detailsRequests !== state.detailsResponses ? (
      <LoadingCount>
        {tct('Loaded [detailsResponses] of [detailsRequests]', state)}
      </LoadingCount>
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

export default Transactions;
