import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {
  eventHasSyntheticTrace,
  isWebVitalsEvent,
  TRACE_WATERFALL_PREFERENCES_KEY,
} from 'sentry/components/events/interfaces/performance/utils';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
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
import {useTraceStateAnalytics} from 'sentry/views/performance/newTraceDetails/useTraceStateAnalytics';
import {getTraceTargetFromEvent} from 'sentry/views/performance/traceDetails/traceTarget';

import {TraceLinkedIssues} from './traceLinkedIssues';

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
  compressed_timeline: false,
  layout: 'drawer bottom',
  list: {
    width: 0.5,
  },
};

type TracePreviewSource = 'feedback' | 'issues';

interface TracePreviewProps {
  event: Event;
  organization: Organization;
  source: TracePreviewSource;
}

interface TracePreviewWaterfallProps extends TracePreviewProps {
  traceId: string;
}

function TracePreviewWaterfall({
  event,
  organization,
  source,
  traceId,
}: TracePreviewWaterfallProps) {
  const timestamp = isWebVitalsEvent(event)
    ? undefined
    : getEventTimestampInSeconds(event);
  const trace = useTrace({
    timestamp,
    traceSlug: traceId,
    limit: 10000,
    targetEventId: event.id,
    referrer:
      source === 'feedback'
        ? 'api.trace-view.feedback.get-events'
        : 'api.trace-view.issues.get-events',
  });
  const params = useTraceQueryParams({timestamp});
  const tree = useIssuesTraceTree({trace, replay: null});

  useTraceStateAnalytics({
    trace,
    organization,
    traceTreeSource:
      source === 'feedback'
        ? 'feedback_details_trace_preview'
        : 'issue_details_trace_preview',
    tree,
  });

  const rootEventResults = useTraceRootEvent({
    tree,
    logs: undefined,
    timestamp,
    traceId,
  });
  const traceEventView = useTraceEventView(traceId, params);

  return (
    <TraceContainer>
      <IssuesTraceWaterfall
        tree={tree}
        trace={trace}
        traceSlug={traceId}
        rootEventResults={rootEventResults}
        organization={organization}
        traceEventView={traceEventView}
        source={source}
        replay={null}
        event={event}
      />
    </TraceContainer>
  );
}

export function TracePreview({event, organization, source}: TracePreviewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const preferences = useMemo(
    () =>
      getInitialTracePreferences(
        TRACE_WATERFALL_PREFERENCES_KEY,
        DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
        'issues'
      ),
    []
  );

  if (!traceId || eventHasSyntheticTrace(event)) {
    return null;
  }

  return (
    <Fragment>
      <TraceLinkedIssues
        event={event}
        source={
          source === 'feedback'
            ? 'feedback-details-trace-preview'
            : 'issue-details-trace-preview'
        }
      />
      <LazyRender observerOptions={ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS}>
        {organization.features.includes('profiling') && (
          <TraceStateProvider
            initialPreferences={preferences}
            preferencesStorageKey={TRACE_WATERFALL_PREFERENCES_KEY}
          >
            <TracePreviewWaterfall
              event={event}
              organization={organization}
              source={source}
              traceId={traceId}
            />
          </TraceStateProvider>
        )}
      </LazyRender>
    </Fragment>
  );
}

export function TracePreviewFullTraceButton({
  event,
  organization,
  source,
}: TracePreviewProps) {
  const location = useLocation();
  const traceTarget = getTraceTargetFromEvent(
    event,
    organization,
    {
      ...location,
      query: {
        groupId: event.groupID,
        referrer: location.query.referrer,
      },
    },
    source === 'feedback'
      ? TraceViewSources.FEEDBACK_DETAILS
      : TraceViewSources.ISSUE_DETAILS
  );
  const commonProps = {
    children: t('View Full Trace'),
    size: 'xs' as const,
    to: getTraceLinkForIssue(traceTarget),
  };

  if (source === 'feedback') {
    return (
      <LinkButton
        {...commonProps}
        onClick={() => {
          trackAnalytics('quick_trace.trace_id.clicked', {
            organization,
            source: TraceViewSources.FEEDBACK_DETAILS,
          });
        }}
      />
    );
  }

  return (
    <LinkButton
      {...commonProps}
      analyticsEventName="Issue Details: View Full Trace Action Button Clicked"
      analyticsEventKey="issue_details.view_full_trace_action_button_clicked"
    />
  );
}

const TraceContainer = styled('div')`
  position: relative;
`;
