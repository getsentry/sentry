import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {
  isWebVitalsEvent,
  TRACE_WATERFALL_PREFERENCES_KEY,
} from 'sentry/components/events/interfaces/performance/utils';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceIssueEvent} from 'sentry/views/issueDetails/traceTimeline/traceIssue';
import {useTraceTimelineEvents} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';
import {IssuesTraceWaterfall} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfall';
import {getTraceLinkForIssue} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfallOverlay';
import {useIssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useIssuesTraceTree';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  getInitialTracePreferences,
  type TracePreferencesState,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {useTraceEventView} from 'sentry/views/performance/newTraceDetails/useTraceEventView';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';
import useTraceStateAnalytics from 'sentry/views/performance/newTraceDetails/useTraceStateAnalytics';

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

interface EventTraceViewInnerProps {
  event: Event;
  organization: Organization;
  traceId: string;
}

function EventTraceViewInner({event, organization, traceId}: EventTraceViewInnerProps) {
  const timestamp = isWebVitalsEvent(event)
    ? undefined
    : getEventTimestampInSeconds(event);

  const trace = useTrace({
    timestamp,
    traceSlug: traceId,
    limit: 10000,
    targetEventId: event.id,
  });
  const params = useTraceQueryParams({
    timestamp,
  });
  const tree = useIssuesTraceTree({trace, replay: null});

  useTraceStateAnalytics({
    trace,
    organization,
    traceTreeSource: 'issue_details_trace_preview',
    tree,
  });

  const rootEventResults = useTraceRootEvent({
    tree,
    logs: undefined,
    traceId,
  });

  const traceEventView = useTraceEventView(traceId, params);

  if (!traceId) {
    return null;
  }

  return (
    <IssuesTraceContainer>
      <IssuesTraceWaterfall
        tree={tree}
        trace={trace}
        traceSlug={traceId}
        rootEventResults={rootEventResults}
        organization={organization}
        traceEventView={traceEventView}
        source="issues"
        replay={null}
        event={event}
      />
    </IssuesTraceContainer>
  );
}

function OneOtherIssueEvent({event}: {event: Event}) {
  const {isLoading, oneOtherIssueEvent} = useTraceTimelineEvents({event});
  useRouteAnalyticsParams(oneOtherIssueEvent ? {has_related_trace_issue: true} : {});

  if (isLoading || !oneOtherIssueEvent) {
    return null;
  }

  return (
    <Fragment>
      <span>{t('One other issue appears in the same trace.')}</span>
      <TraceIssueEvent event={oneOtherIssueEvent} />
    </Fragment>
  );
}

const IssuesTraceContainer = styled('div')`
  position: relative;
`;

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const location = useLocation();
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  // Span Evidence section contains the trace view already
  const preferences = useMemo(
    () =>
      getInitialTracePreferences(
        TRACE_WATERFALL_PREFERENCES_KEY,
        DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES
      ),
    []
  );

  // Performance issues have a Span Evidence section that contains the trace view
  if (!traceId || issueTypeConfig.spanEvidence.enabled) {
    return null;
  }

  const traceTarget = generateTraceTarget(
    event,
    organization,
    {
      ...location,
      query: {
        ...location.query,
        groupId: event.groupID,
      },
    },
    TraceViewSources.ISSUE_DETAILS
  );

  const hasTracePreviewFeature = organization.features.includes('profiling');

  return (
    <InterimSection
      type={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        <ButtonBar>
          <LinkButton
            size="xs"
            to={getTraceLinkForIssue(traceTarget)}
            analyticsEventName="Issue Details: View Full Trace Action Button Clicked"
            analyticsEventKey="issue_details.view_full_trace_action_button_clicked"
          >
            {t('View Full Trace')}
          </LinkButton>
        </ButtonBar>
      }
    >
      <OneOtherIssueEvent event={event} />
      {hasTracePreviewFeature && (
        <TraceStateProvider
          initialPreferences={preferences}
          preferencesStorageKey={TRACE_WATERFALL_PREFERENCES_KEY}
        >
          <EventTraceViewInner
            event={event}
            organization={organization}
            traceId={traceId}
          />
        </TraceStateProvider>
      )}
    </InterimSection>
  );
}
