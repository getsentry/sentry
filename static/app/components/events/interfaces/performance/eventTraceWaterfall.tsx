import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
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

interface EventTraceWaterfallProps {
  event: Event;
  organization: Organization;
}

export default function EventTraceWaterfall({
  event,
  organization,
}: EventTraceWaterfallProps) {
  // Assuming profile exists, should be checked in the parent component
  const traceId = event.contexts.trace!.trace_id!;
  const location = useLocation();

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

  const scrollToNode = useMemo(() => {
    const firstTransactionEventId = trace.data?.transactions[0]?.event_id;
    return {eventId: firstTransactionEventId};
  }, [trace.data]);

  if (trace.isPending || rootEvent.isPending || !rootEvent.data || hasNoTransactions) {
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
            tree={tree}
            trace={trace}
            replay={null}
            rootEvent={rootEvent}
            traceSlug={undefined}
            organization={organization}
            traceEventView={traceEventView}
            meta={meta}
            source="issues"
            scrollToNode={scrollToNode}
            isEmbedded
          />
        </TraceViewWaterfallWrapper>
      </TraceStateProvider>
    </Fragment>
  );
}

const TraceViewWaterfallWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 500px;
`;
