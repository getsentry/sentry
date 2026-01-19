import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import Loading from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useReplayTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useReplayTraceMeta';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {useTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {getInitialTracePreferences} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import useTraceStateAnalytics from 'sentry/views/performance/newTraceDetails/useTraceStateAnalytics';
import EmptyState from 'sentry/views/replays/detail/emptyState';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import {useReplayTraces} from './useReplayTraces';

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
  missing_instrumentation: true,
  autogroup: {
    parent: true,
    sibling: true,
  },
  layout: 'drawer bottom',
  list: {
    width: 0.5,
  },
};

const REPLAY_TRACE_WATERFALL_PREFERENCES_KEY = 'replay-trace-waterfall-preferences';

export function NewTraceView({replay}: {replay: undefined | HydratedReplayRecord}) {
  const preferences = useMemo(
    () =>
      getInitialTracePreferences(
        REPLAY_TRACE_WATERFALL_PREFERENCES_KEY,
        DEFAULT_REPLAY_TRACE_VIEW_PREFERENCES
      ),
    []
  );

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey={REPLAY_TRACE_WATERFALL_PREFERENCES_KEY}
    >
      <NewTraceViewImpl replay={replay} />
    </TraceStateProvider>
  );
}

function NewTraceViewImpl({replay}: {replay: undefined | HydratedReplayRecord}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {eventView, indexComplete, indexError, replayTraces} = useReplayTraces({
    replayRecord: replay,
  });

  const firstTrace = replayTraces?.[0];
  const trace = useTrace({
    traceSlug: firstTrace?.traceSlug,
    timestamp: firstTrace?.timestamp,
  });
  const meta = useReplayTraceMeta(replay);
  const tree = useTraceTree({
    trace,
    replay: replay ?? null,
  });

  useTraceStateAnalytics({
    trace,
    meta,
    organization,
    traceTreeSource: 'replay_details',
    tree,
  });

  const rootEvent = useTraceRootEvent({
    tree,
    logs: undefined,
    traceId: firstTrace?.traceSlug ?? '',
  });

  const otherReplayTraces = useMemo(() => {
    if (!replayTraces) {
      return [];
    }
    return replayTraces.slice(1);
  }, [replayTraces]);

  if (indexError) {
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

  if (!replay || !indexComplete || !replayTraces || !eventView) {
    // Show the blank screen until we start fetching, thats when you get a spinner
    return (
      <StyledPlaceholder height="100%">
        {indexComplete ? null : <Loading />}
      </StyledPlaceholder>
    );
  }

  const project = projects.find(p => p.id === replay.project_id);
  const hasPerformance = project?.firstTransactionEvent === true;
  const performanceActive =
    organization.features.includes('performance-view') && hasPerformance;

  if (!firstTrace) {
    return <TracesNotFound performanceActive={performanceActive} />;
  }

  return (
    <Stack height="100%">
      <TraceWaterfall
        traceSlug={firstTrace.traceSlug}
        trace={trace}
        tree={tree}
        rootEventResults={rootEvent}
        replayTraces={otherReplayTraces}
        organization={organization}
        traceEventView={eventView}
        meta={meta}
        source="replay"
        replay={replay}
      />
    </Stack>
  );
}

// This has the gray background, to match other loaders on Replay Details
const StyledPlaceholder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

// White background, to match the loaded component
const BorderedSection = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;
