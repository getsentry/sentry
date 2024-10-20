import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useTrace} from './traceApi/useTrace';
import {useTraceMeta} from './traceApi/useTraceMeta';
import {useTraceRootEvent} from './traceApi/useTraceRootEvent';
import {useTraceTree} from './traceApi/useTraceTree';
import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  loadTraceViewPreferences,
} from './traceState/tracePreferences';
import {TraceStateProvider} from './traceState/traceStateProvider';
import {TraceMetadataHeader} from './traceMetadataHeader';
import {TraceWaterfall} from './traceWaterfall';

export function TraceView() {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = useMemo(() => {
    const slug = params.traceSlug?.trim() ?? '';
    // null and undefined are not valid trace slugs, but they can be passed
    // in the URL and need to check for their string coerced values.
    if (!slug || slug === 'null' || slug === 'undefined') {
      Sentry.withScope(scope => {
        scope.setFingerprint(['trace-null-slug']);
        Sentry.captureMessage(`Trace slug is empty`);
      });
    }
    return slug;
  }, [params.traceSlug]);

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
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start: startTimeStamp,
      end: endTimeStamp,
      range: !(startTimeStamp || endTimeStamp) ? statsPeriod : undefined,
    });
  }, [queryParams, traceSlug]);

  const preferences = useMemo(
    () =>
      loadTraceViewPreferences('trace-view-preferences') ||
      DEFAULT_TRACE_VIEW_PREFERENCES,
    []
  );

  const metaResults = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const traceResults = useTrace({traceSlug, timestamp: queryParams.timestamp});
  const tree = useTraceTree({traceSlug, traceResults, metaResults, replayRecord: null});
  const rootEvent = useTraceRootEvent(traceResults.data ?? null);

  return (
    <SentryDocumentTitle
      title={`${t('Trace Details')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey="trace-view-preferences"
      >
        <NoProjectMessage organization={organization}>
          <TraceExternalLayout>
            <TraceMetadataHeader
              rootEventResults={rootEvent}
              organization={organization}
              traceSlug={traceSlug}
              traceEventView={traceEventView}
            />
            <TraceInnerLayout>
              <TraceWaterfall
                traceSlug={traceSlug}
                tree={tree}
                organization={organization}
                rootEvent={rootEvent}
                traceEventView={traceEventView}
                metaResults={metaResults}
                replayRecord={null}
                source="performance"
                isEmbedded={false}
              />
            </TraceInnerLayout>
          </TraceExternalLayout>
        </NoProjectMessage>
      </TraceStateProvider>
    </SentryDocumentTitle>
  );
}

const TraceExternalLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;

  ~ footer {
    display: none;
  }
`;

const TraceInnerLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  padding: ${space(2)};
  background-color: ${p => p.theme.background};
`;
