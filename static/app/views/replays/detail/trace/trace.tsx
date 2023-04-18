import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {useTransactionData} from 'sentry/views/replays/detail/trace/replayTransactionContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: undefined | ReplayRecord;
};

function Trace({replayRecord}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {state, eventView} = useTransactionData();

  if (!replayRecord || !state.traces?.length) {
    return <StyledPlaceholder height="100%" />;
  }

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
    </FluidHeight>
  );
}

const StyledPlaceholder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default Trace;
