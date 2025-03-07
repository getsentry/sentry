import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {LinkButton} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceIssueEvent} from 'sentry/views/issueDetails/traceTimeline/traceIssue';
import {useTraceTimelineEvents} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';
import {IssuesTraceWaterfall} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfall';
import {useIssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useIssuesTraceTree';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  loadTraceViewPreferences,
  type TracePreferencesState,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {useTraceEventView} from 'sentry/views/performance/newTraceDetails/useTraceEventView';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

const DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: true,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.4,
      'trace context height': 150,
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
  traceTarget: LocationDescriptor;
}

function EventTraceViewInner({
  event,
  organization,
  traceId,
  traceTarget,
}: EventTraceViewInnerProps) {
  const timestamp = new Date(event.dateReceived).getTime() / 1e3;

  const trace = useTrace({
    timestamp,
    traceSlug: traceId,
    limit: 10000,
  });
  const params = useTraceQueryParams({
    timestamp,
  });
  const meta = useTraceMeta([{traceSlug: traceId, timestamp}]);
  const tree = useIssuesTraceTree({trace, meta, replay: null});

  const shouldLoadTraceRoot = !trace.isPending && trace.data;

  const rootEvent = useTraceRootEvent(shouldLoadTraceRoot ? trace.data : null);
  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('issue-details-trace-view-preferences') ||
      DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
    []
  );

  const traceEventView = useTraceEventView(traceId, params);

  if (!traceId) {
    return null;
  }

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey="issue-details-view-preferences"
    >
      <IssuesTraceContainer>
        <IssuesTraceWaterfall
          tree={tree}
          trace={trace}
          traceSlug={traceId}
          rootEvent={rootEvent}
          organization={organization}
          traceEventView={traceEventView}
          meta={meta}
          source="issues"
          replay={null}
          event={event}
        />
        <IssuesTraceOverlayContainer
          to={getHrefFromTraceTarget(traceTarget)}
          onClick={() => {
            trackAnalytics('issue_details.view_full_trace_waterfall_clicked', {
              organization,
            });
          }}
        />
      </IssuesTraceContainer>
    </TraceStateProvider>
  );
}

function getHrefFromTraceTarget(traceTarget: LocationDescriptor) {
  if (typeof traceTarget === 'string') {
    return traceTarget;
  }

  const searchParams = new URLSearchParams();
  for (const key in traceTarget.query) {
    if (defined(traceTarget.query[key])) {
      searchParams.append(key, traceTarget.query[key]);
    }
  }

  return `${traceTarget.pathname}?${searchParams.toString()}`;
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

const IssuesTraceOverlayContainer = styled(Link)`
  position: absolute;
  inset: 0;
  z-index: 10;
`;

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const location = useLocation();

  if (!traceId) {
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

  const hasProfilingFeature = organization.features.includes('profiling');
  const hasTracePreviewFeature =
    hasProfilingFeature &&
    // Only display this for error or default events since performance events are handled elsewhere
    group.issueCategory !== IssueCategory.PERFORMANCE;

  return (
    <InterimSection
      type={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        <LinkButton
          size="xs"
          to={getHrefFromTraceTarget(traceTarget)}
          analyticsEventName="Issue Details: View Full Trace Action Button Clicked"
          analyticsEventKey="issue_details.view_full_trace_action_button_clicked"
        >
          {t('View Full Trace')}
        </LinkButton>
      }
    >
      <OneOtherIssueEvent event={event} />
      {hasTracePreviewFeature && (
        <EventTraceViewInner
          event={event}
          organization={organization}
          traceId={traceId}
          traceTarget={traceTarget}
        />
      )}
    </InterimSection>
  );
}
