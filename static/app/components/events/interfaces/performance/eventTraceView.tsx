import {useMemo} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {IssuesTraceWaterfall} from 'sentry/views/performance/newTraceDetails/issuesTraceWaterfall';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {useTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceTree';
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
}

function EventTraceViewInner({event, organization}: EventTraceViewInnerProps) {
  // Assuming profile exists, should be checked in the parent component
  const traceId = event.contexts.trace!.trace_id!;
  const trace = useTrace({
    traceSlug: traceId ? traceId : undefined,
    limit: 10000,
  });
  const meta = useTraceMeta([{traceSlug: traceId, timestamp: undefined}]);
  const tree = useTraceTree({trace, meta, replay: null});

  const hasNoTransactions = meta.data?.transactions === 0;
  const shouldLoadTraceRoot = !trace.isPending && trace.data && !hasNoTransactions;

  const rootEvent = useTraceRootEvent(shouldLoadTraceRoot ? trace.data! : null);

  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('issue-details-trace-view-preferences') ||
      DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
    []
  );

  const params = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceId, params);

  const scrollToNode = useMemo(() => {
    const firstTransactionEventId = trace.data?.transactions[0]?.event_id;
    return {eventId: firstTransactionEventId};
  }, [trace.data]);

  if (trace.isPending || rootEvent.isPending || !rootEvent.data || hasNoTransactions) {
    return null;
  }

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey="issue-details-view-preferences"
    >
      <TraceViewWaterfallWrapper rowCount={tree.type === 'trace' ? tree.list.length : 6}>
        <IssuesTraceWaterfall
          tree={tree}
          trace={trace}
          traceSlug={traceId}
          rootEvent={rootEvent}
          organization={organization}
          traceEventView={traceEventView}
          meta={meta}
          source="issues"
          scrollToNode={scrollToNode}
          replay={null}
        />
      </TraceViewWaterfallWrapper>
    </TraceStateProvider>
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

const ROW_HEIGHT = 24;
const MIN_ROW_COUNT = 1;
<<<<<<< HEAD
const MAX_HEIGHT = 400;
=======
const MAX_HEIGHT = 500;
>>>>>>> 1850b577422 (ref(trace) adjust height of container for trace view)
const MAX_ROW_COUNT = Math.floor(MAX_HEIGHT / ROW_HEIGHT);
const HEADER_HEIGHT = 32;

const TraceViewWaterfallWrapper = styled('div')<{rowCount: number}>`
  display: flex;
  flex-direction: column;
  max-height: ${MAX_HEIGHT}px;
  height: ${p =>
    Math.min(Math.max(p.rowCount, MIN_ROW_COUNT), MAX_ROW_COUNT) * ROW_HEIGHT +
    HEADER_HEIGHT}px;
`;
