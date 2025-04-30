import {lazy, Suspense, useMemo} from 'react';
import styled from '@emotion/styled';

import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
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
import {useTraceWaterfallModels} from 'sentry/views/performance/newTraceDetails/useTraceWaterfallModels';

const LazyIssuesTraceWaterfall = lazy(() =>
  import('sentry/views/performance/newTraceDetails/issuesTraceWaterfall').then(
    module => ({default: module.IssuesTraceWaterfall})
  )
);

const DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: true,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.4,
      'trace grid height': 150,
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

interface SpanEvidenceTraceViewProps {
  event: Event;
  organization: Organization;
  traceId: string;
}

export function SpanEvidenceTraceView(props: SpanEvidenceTraceViewProps) {
  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('issue-details-trace-view-preferences') ||
      DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES,
    []
  );

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey="issue-details-trace-view-preferences"
    >
      <SpanEvidenceTraceViewImpl {...props} />
    </TraceStateProvider>
  );
}

function SpanEvidenceTraceViewImpl({
  event,
  organization,
  traceId,
}: SpanEvidenceTraceViewProps) {
  const timestamp = new Date(event.dateReceived).getTime() / 1e3;

  const trace = useTrace({
    timestamp,
    traceSlug: traceId,
    limit: 10000,
  });
  const meta = useTraceMeta([{traceSlug: traceId, timestamp}]);
  const tree = useIssuesTraceTree({trace, meta, replay: null});

  const rootEvent = useTraceRootEvent({
    tree,
    logs: undefined,
    traceId,
  });

  const params = useTraceQueryParams({timestamp});
  const traceEventView = useTraceEventView(traceId, params);

  const traceWaterfallModels = useTraceWaterfallModels();

  if (!traceId) {
    return null;
  }

  return (
    <IssuesTraceContainer>
      <Suspense fallback={null}>
        <LazyIssuesTraceWaterfall
          tree={tree}
          trace={trace}
          traceSlug={traceId}
          rootEventResults={rootEvent}
          organization={organization}
          traceEventView={traceEventView}
          meta={meta}
          source="issues"
          replay={null}
          event={event}
          traceWaterfallModels={traceWaterfallModels}
        />
      </Suspense>
    </IssuesTraceContainer>
  );
}

const IssuesTraceContainer = styled('div')`
  position: relative;
`;
