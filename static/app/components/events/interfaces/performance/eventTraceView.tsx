import {useMemo} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {IssuesTraceWaterfall} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfall';
import {useIssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useIssuesTraceTree';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
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
  const trace = useTrace({
    traceSlug: traceId,
    limit: 10000,
  });
  const meta = useTraceMeta([{traceSlug: traceId, timestamp: undefined}]);
  const tree = useIssuesTraceTree({trace, meta, replay: null});

  const shouldLoadTraceRoot = !trace.isPending && trace.data;

  const rootEvent = useTraceRootEvent(shouldLoadTraceRoot ? trace.data! : null);
  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('issue-details-trace-view-preferences') ||
      DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
    []
  );

  const params = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceId, params);

  if (!traceId) {
    return null;
  }

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey="issue-details-view-preferences"
    >
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
    </TraceStateProvider>
  );
}

interface EventTraceViewProps extends Omit<EventTraceViewInnerProps, 'traceId'> {
  group: Group;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  if (!traceId) {
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
        <TraceDataSection event={event} />
        {hasTracePreviewFeature && (
          <EventTraceViewInner
            event={event}
            organization={organization}
            traceId={traceId}
          />
        )}
      </InterimSection>
    </ErrorBoundary>
  );
}
