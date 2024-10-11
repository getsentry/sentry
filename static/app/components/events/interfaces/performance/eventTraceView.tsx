import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {TraceViewWaterfall} from 'sentry/views/performance/newTraceDetails';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {useTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceTree';
import {
  loadTraceViewPreferences,
  type TracePreferencesState,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

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
  autogroup: {
    parent: true,
    sibling: true,
  },
  layout: 'drawer bottom',
  list: {
    width: 0.5,
  },
};

interface EventTraceViewInnerProps {
  event: Event;
  organization: Organization;
}

function EventTraceViewInner({event, organization}: EventTraceViewInnerProps) {
  // Assuming profile exists, should be checked in the parent component
  const traceId = event.contexts.trace!.trace_id!;
  const location = useLocation();

  const traceResults = useTrace({
    traceSlug: traceId ? traceId : undefined,
    limit: 10000,
  });
  const metaResults = useTraceMeta([{traceSlug: traceId, timestamp: undefined}]);
  const tree = useTraceTree({traceResults, metaResults, replayRecord: null});

  const hasNoTransactions = metaResults.data?.transactions === 0;
  const shouldLoadTraceRoot =
    !traceResults.isPending && traceResults.data && !hasNoTransactions;

  const rootEvent = useTraceRootEvent(shouldLoadTraceRoot ? traceResults.data! : null);

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

  if (
    traceResults.isPending ||
    rootEvent.isPending ||
    !rootEvent.data ||
    hasNoTransactions
  ) {
    return null;
  }

  return (
    <Fragment>
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey="issue-details-view-preferences"
      >
        <TraceViewWaterfallWrapper>
          <TraceViewWaterfall
            traceSlug={undefined}
            tree={tree}
            rootEvent={rootEvent}
            organization={organization}
            traceEventView={traceEventView}
            metaResults={metaResults}
            source="issues"
            replayRecord={null}
            scrollToNode={
              traceResults.data?.transactions[0]?.event_id
                ? {
                    // Scroll/highlight the current transaction
                    path: [`txn-${traceResults.data.transactions[0].event_id}`],
                  }
                : undefined
            }
            isEmbedded
          />
        </TraceViewWaterfallWrapper>
      </TraceStateProvider>
    </Fragment>
  );
}

interface EventTraceViewProps extends EventTraceViewInnerProps {
  group: Group;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  // Check trace id exists
  if (!event || !event.contexts.trace?.trace_id) {
    return null;
  }

  const hasProfilingFeature = organization.features.includes('profiling');
  const hasIssueDetailsTrace = organization.features.includes(
    'issue-details-always-show-trace'
  );
  const hasTracePreviewFeature = hasProfilingFeature && hasIssueDetailsTrace;

  // Only display this for error or default events since performance events are handled elsewhere
  if (group.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <InterimSection type={SectionKey.TRACE} title={t('Trace')}>
        <TraceContentWrapper>
          <div>
            <TraceDataSection event={event} />
          </div>
          {hasTracePreviewFeature && (
            <EventTraceViewInner event={event} organization={organization} />
          )}
        </TraceContentWrapper>
      </InterimSection>
    </ErrorBoundary>
  );
}

const TraceContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const TraceViewWaterfallWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 500px;
`;
