import {useMemo} from 'react';
import styled from '@emotion/styled';
import qs from 'qs';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  getTraceViewQueryStatus,
  TraceViewWaterfall,
} from 'sentry/views/performance/newTraceDetails';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

const DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: false,
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
  const profileId = event.contexts.trace!.trace_id!;
  const trace = useTrace({
    traceSlug: profileId ? profileId : undefined,
    limit: 10000,
  });
  const rootEvent = useTraceRootEvent(trace.data ?? null);

  const meta = useTraceMeta([{traceSlug: profileId, timestamp: undefined}]);

  const queryParams = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const timestamp: string | undefined = decodeScalar(normalizedParams.timestamp);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
    const numberTimestamp = timestamp ? Number(timestamp) : undefined;

    return {start, end, statsPeriod, timestamp: numberTimestamp, useSpans: 1};
  }, []);

  const traceEventView = useMemo(() => {
    const {start, end, statsPeriod, timestamp} = queryParams;

    let startTimeStamp = start;
    let endTimeStamp = end;

    // If timestamp exists in the query params, we want to use it to set the start and end time
    // with a buffer of 1.5 days, for retrieving events belonging to the trace.
    if (typeof timestamp === 'number') {
      const buffer = 36 * 60 * 60 * 1000; // 1.5 days in milliseconds
      const dateFromTimestamp = new Date(timestamp * 1000);

      startTimeStamp = new Date(dateFromTimestamp.getTime() - buffer).toISOString();
      endTimeStamp = new Date(dateFromTimestamp.getTime() + buffer).toISOString();
    }

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${profileId}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${profileId}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start: startTimeStamp,
      end: endTimeStamp,
      range: !(startTimeStamp || endTimeStamp) ? statsPeriod : undefined,
    });
  }, [queryParams, profileId]);

  if (trace.isPending || rootEvent.isPending || !rootEvent.data) {
    return null;
  }

  return (
    <InterimSection type={SectionKey.TRACE} title={t('Trace Preview')}>
      <SpanEvidenceKeyValueList event={rootEvent.data} projectSlug={projectSlug} />
      <TraceStateProvider
        initialPreferences={DEFAULT_ISSUE_DETAILS_TRACE_VIEW_PREFERENCES}
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
  if (!hasProfilingFeature) {
    return null;
  }

  // Only display this for error or default events since performance events are handled elsewhere
  if (group.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <EventTraceViewInner
      event={event}
      organization={organization}
      projectSlug={projectSlug}
    />
  );
}

const TraceViewWaterfallWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 750px;
`;
