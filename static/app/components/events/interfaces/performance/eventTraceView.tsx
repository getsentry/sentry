import {useMemo} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  getTraceViewQueryStatus,
  TraceViewWaterfall,
} from 'sentry/views/performance/newTraceDetails';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  loadTraceViewPreferences,
  type TracePreferencesState,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

const DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: true,
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

interface EventTraceViewInnerProps {
  event: Event;
  organization: Organization;
  projectSlug: string;
}

function EventTraceViewInner({
  event,
  organization,
  projectSlug,
}: EventTraceViewInnerProps) {
  // Assuming profile exists, should be checked in the parent component
  const traceId = event.contexts.trace!.trace_id!;
  const location = useLocation();

  const trace = useTrace({
    traceSlug: traceId ? traceId : undefined,
    limit: 10000,
  });
  const meta = useTraceMeta([{traceSlug: traceId, timestamp: undefined}]);

  const hasNoTransactions = meta.data?.transactions === 0;
  const shouldLoadTraceRoot = !trace.isPending && trace.data && !hasNoTransactions;

  const rootEvent = useTraceRootEvent(shouldLoadTraceRoot ? trace.data! : null);

  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('issue-details-trace-view-preferences') ||
      DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
    []
  );

  const traceEventView = useMemo(() => {
    const statsPeriod = location.query.statsPeriod as string | undefined;
    // Not currently expecting start/end timestamps to be applied to this view

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceId}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceId}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      range: statsPeriod,
    });
  }, [location.query.statsPeriod, traceId]);

  if (trace.isPending || rootEvent.isPending || !rootEvent.data || hasNoTransactions) {
    return null;
  }

  return (
    <InterimSection type={SectionKey.TRACE} title={t('Trace Preview')}>
      <SpanEvidenceKeyValueList event={rootEvent.data} projectSlug={projectSlug} />
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey="issue-details-view-preferences"
      >
        <TraceViewWaterfallWrapper>
          <TraceViewWaterfall
            traceSlug={undefined}
            trace={trace.data ?? null}
            status={getTraceViewQueryStatus(trace.status, meta.status)}
            rootEvent={rootEvent}
            organization={organization}
            traceEventView={traceEventView}
            metaResults={meta}
            source="issues"
            replayRecord={null}
            scrollToNode={
              trace.data?.transactions[0]?.event_id
                ? {
                    // Scroll/highlight the current transaction
                    path: [`txn-${trace.data.transactions[0].event_id}`],
                  }
                : undefined
            }
            isEmbedded
          />
        </TraceViewWaterfallWrapper>
      </TraceStateProvider>
    </InterimSection>
  );
}

interface EventTraceViewProps extends EventTraceViewInnerProps {
  group: Group;
}

export function EventTraceView({
  group,
  event,
  organization,
  projectSlug,
}: EventTraceViewProps) {
  // Check trace id exists
  if (!event || !event.contexts.trace?.trace_id) {
    return null;
  }

  const hasProfilingFeature = organization.features.includes('profiling');
  const hasIssueDetailsTrace = organization.features.includes(
    'issue-details-always-show-trace'
  );
  if (!hasProfilingFeature || !hasIssueDetailsTrace) {
    return null;
  }

  // Only display this for error or default events since performance events are handled elsewhere
  if (group.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <EventTraceViewInner
        event={event}
        organization={organization}
        projectSlug={projectSlug}
      />
    </ErrorBoundary>
  );
}

const TraceViewWaterfallWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 500px;
`;
