import {useMemo} from 'react';
import styled from '@emotion/styled';

import Loading from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {TraceViewWaterfall} from 'sentry/views/performance/newTraceDetails';
import {useReplayTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useReplayTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
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

import {loadTraceViewPreferences} from '../../../performance/newTraceDetails/traceState/tracePreferences';

function TracesNotFound({performanceActive}: {performanceActive: boolean}) {
  // We want to send the 'trace_status' data if the project actively uses and has access to the performance monitoring.
  useRouteAnalyticsParams(performanceActive ? {trace_status: 'trace missing'} : {});

  return (
    <BorderedSection data-test-id="replay-details-trace-tab">
      <EmptyState data-test-id="empty-state">
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

const DEFAULT_REPLAY_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: false,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.4,
    },
    layoutOptions: [],
  },
  layout: 'drawer bottom',
  list: {
    width: 0.5,
  },
};

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

  const metaResults = useReplayTraceMeta(replayRecord);

  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('replay-trace-view-preferences') ||
      DEFAULT_REPLAY_TRACE_VIEW_PREFERENCES,
    []
  );

  const traceSplitResults = useMemo(() => {
    return {
      transactions: traces ?? [],
      orphan_errors: orphanErrors ?? [],
    };
  }, [traces, orphanErrors]);

  const rootEvent = useTraceRootEvent(traceSplitResults);
  useFetchTransactions();

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

  if (!replayRecord || !didInit || (isFetching && !traces?.length) || !eventView) {
    // Show the blank screen until we start fetching, thats when you get a spinner
    return (
      <StyledPlaceholder height="100%">
        {isFetching ? <Loading /> : null}
      </StyledPlaceholder>
    );
  }

  const project = projects.find(p => p.id === replayRecord.project_id);
  const hasPerformance = project?.firstTransactionEvent === true;
  const performanceActive =
    organization.features.includes('performance-view') && hasPerformance;

  if (!hasTraceData(traces, orphanErrors)) {
    return <TracesNotFound performanceActive={performanceActive} />;
  }

  if (organization.features.includes('replay-trace-view-v1')) {
    return (
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey="replay-trace-view-preferences"
      >
        <TraceViewWaterfallWrapper>
          <TraceViewWaterfall
            traceSlug="Replay"
            status={errors.length > 0 ? 'error' : isFetching ? 'loading' : 'success'}
            trace={traceSplitResults}
            organization={organization}
            traceEventView={eventView}
            metaResults={metaResults}
            rootEvent={rootEvent}
            source="replay"
            replayRecord={replayRecord}
          />
        </TraceViewWaterfallWrapper>
      </TraceStateProvider>
    );
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

const TraceViewWaterfallWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

export default Trace;
