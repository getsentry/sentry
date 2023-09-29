import styled from '@emotion/styled';

import Loading from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TraceError, TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import TraceView, {
  StyledTracePanel,
} from 'sentry/views/performance/traceDetails/traceView';
import {hasTraceData} from 'sentry/views/performance/traceDetails/utils';
import EmptyState from 'sentry/views/replays/detail/emptyState';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {
  useFetchTransactions,
  useTransactionData,
} from 'sentry/views/replays/detail/trace/replayTransactionContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

function TracesNotFound({performanceActive}: {performanceActive: boolean}) {
  // We want to send the 'trace_status' data if the project actively uses and has access to the performance monitoring.
  useRouteAnalyticsParams(performanceActive ? {trace_status: 'trace missing'} : {});

  return (
    <BorderedSection data-test-id="replay-details-trace-tab">
      <EmptyState>
        <p>{t('No traces found')}</p>
      </EmptyState>
    </BorderedSection>
  );
}

function TraceFound({
  organization,
  performanceActive,
  eventView,
  traces,
  orphanErrors,
}: {
  eventView: EventView | null;
  organization: Organization;
  performanceActive: boolean;
  traces: TraceFullDetailed[] | null;
  orphanErrors?: TraceError[];
}) {
  const location = useLocation();

  // We want to send the 'trace_status' data if the project actively uses and has access to the performance monitoring.
  useRouteAnalyticsParams(performanceActive ? {trace_status: 'success'} : {});

  return (
    <OverflowScrollBorderedSection>
      <TraceView
        meta={null}
        traces={traces || []}
        location={location}
        organization={organization}
        traceEventView={eventView!}
        traceSlug="Replay"
        orphanErrors={orphanErrors}
      />
    </OverflowScrollBorderedSection>
  );
}

type Props = {
  replayRecord: undefined | ReplayRecord;
};

function Trace({replayRecord}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {
    state: {didInit, errors, isFetching, traces, orphanErrors},
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

  const project = projects.find(p => p.id === replayRecord.project_id);
  const hasPerformance = project?.firstTransactionEvent === true;
  const performanceActive =
    organization.features.includes('performance-view') && hasPerformance;

  if (!hasTraceData(traces, orphanErrors)) {
    return <TracesNotFound performanceActive={performanceActive} />;
  }

  return (
    <TraceFound
      performanceActive={performanceActive}
      organization={organization}
      eventView={eventView}
      traces={traces ?? []}
      orphanErrors={orphanErrors}
    />
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

const OverflowScrollBorderedSection = styled(BorderedSection)`
  overflow: scroll;

  ${StyledTracePanel} {
    border: none;
  }
`;

export default Trace;
