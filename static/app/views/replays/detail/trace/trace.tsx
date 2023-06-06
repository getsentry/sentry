import styled from '@emotion/styled';

import Loading from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import EmptyState from 'sentry/views/replays/detail/emptyState';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {
  useFetchTransactions,
  useTransactionData,
} from 'sentry/views/replays/detail/trace/replayTransactionContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: undefined | ReplayRecord;
};

function Trace({replayRecord}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {
    state: {didInit, errors, isFetching, traces},
    eventView,
  } = useTransactionData();

  useFetchTransactions();

  if (!replayRecord || !didInit || (isFetching && !traces?.length)) {
    // Show the blank screen until we start fetching, thats when you get a spinner
    return (
      <StyledPlaceholder height="100%">
        {isFetching ? <Loading /> : null}
      </StyledPlaceholder>
    );
  }

  if (errors.length) {
    // Same style as <EmptyStateWarning>
    return (
      <BorderedSection>
        <EmptyState withIcon={false}>
          <IconSad legacySize="54px" />
          <p>{t('Unable to retrieve traces')}</p>
        </EmptyState>
      </BorderedSection>
    );
  }

  if (!traces?.length) {
    return (
      <BorderedSection>
        <EmptyState>
          <p>{t('No traces found')}</p>
        </EmptyState>
      </BorderedSection>
    );
  }

  return (
    <FluidHeight>
      <TraceView
        meta={null}
        traces={traces ?? null}
        location={location}
        organization={organization}
        traceEventView={eventView!}
        traceSlug="Replay"
      />
    </FluidHeight>
  );
}

// This has the gray background, to match other loaders on Replay Details
const StyledPlaceholder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

// White background, to match the loaded component
const BorderedSection = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default Trace;
