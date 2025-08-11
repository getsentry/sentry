import {useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import TraceAiSpans from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {
  TraceViewLogsDataProvider,
  TraceViewLogsSection,
} from 'sentry/views/performance/newTraceDetails/traceOurlogs';
import {TraceSummarySection} from 'sentry/views/performance/newTraceDetails/traceSummary';
import {TraceTabsAndVitals} from 'sentry/views/performance/newTraceDetails/traceTabsAndVitals';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {
  TraceLayoutTabKeys,
  useTraceLayoutTabs,
} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {useTraceWaterfallModels} from 'sentry/views/performance/newTraceDetails/useTraceWaterfallModels';
import {useTraceWaterfallScroll} from 'sentry/views/performance/newTraceDetails/useTraceWaterfallScroll';

import {useTrace} from './traceApi/useTrace';
import {useTraceMeta} from './traceApi/useTraceMeta';
import {useTraceRootEvent} from './traceApi/useTraceRootEvent';
import {useTraceTree} from './traceApi/useTraceTree';
import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  getInitialTracePreferences,
} from './traceState/tracePreferences';
import {TraceStateProvider} from './traceState/traceStateProvider';
import {TraceMetaDataHeader} from './traceHeader';
import {useTraceEventView} from './useTraceEventView';
import {useTraceQueryParams} from './useTraceQueryParams';

function decodeTraceSlug(maybeSlug: string | undefined): string {
  if (!maybeSlug || maybeSlug === 'null' || maybeSlug === 'undefined') {
    Sentry.withScope(scope => {
      scope.setFingerprint(['trace-null-slug']);
      Sentry.captureMessage('Trace slug is empty');
    });

    return '';
  }

  return maybeSlug.trim();
}

const TRACE_VIEW_PREFERENCES_KEY = 'trace-waterfall-preferences';

export function TraceView() {
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = useMemo(() => decodeTraceSlug(params.traceSlug), [params.traceSlug]);

  const preferences = useMemo(
    () =>
      getInitialTracePreferences(
        TRACE_VIEW_PREFERENCES_KEY,
        DEFAULT_TRACE_VIEW_PREFERENCES
      ),
    []
  );

  return (
    <TraceViewLogsDataProvider traceSlug={traceSlug}>
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey={TRACE_VIEW_PREFERENCES_KEY}
      >
        <TraceViewImpl traceSlug={traceSlug} />
      </TraceStateProvider>
    </TraceViewLogsDataProvider>
  );
}

// At this level, we only need the initial logs data once, to populate the header for
// logs only trace views, using the first log event. We read off the same context used
// by the trace logs table, which changes the data based on search filters. We want to decouple
// the trace view state from the logs table state, after initial load.
function useInitialLogsData(): OurLogsResponseItem[] | undefined {
  const logsData = useLogsPageDataQueryResult().data;
  const initialDataRef = useRef<OurLogsResponseItem[] | undefined>(undefined);

  useEffect(() => {
    if (logsData?.length && initialDataRef.current === undefined) {
      initialDataRef.current = logsData;
    }
  }, [logsData]);

  return initialDataRef.current;
}

function TraceViewImpl({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);
  const logsData = useInitialLogsData();
  const hideTraceWaterfallIfEmpty = (logsData?.length ?? 0) > 0;

  const meta = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const trace = useTrace({traceSlug, timestamp: queryParams.timestamp});
  const tree = useTraceTree({traceSlug, trace, replay: null});
  const rootEventResults = useTraceRootEvent({
    tree,
    logs: logsData,
    traceId: traceSlug,
  });
  const traceInnerLayoutRef = useRef<HTMLDivElement>(null);

  const traceWaterfallModels = useTraceWaterfallModels();
  const traceWaterfallScroll = useTraceWaterfallScroll({
    organization,
    tree,
    viewManager: traceWaterfallModels.viewManager,
  });

  const {tabOptions, currentTab, onTabChange} = useTraceLayoutTabs({
    tree,
    logs: logsData,
  });

  return (
    <SentryDocumentTitle
      title={`${t('Trace Details')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <NoProjectMessage organization={organization}>
        <TraceExternalLayout>
          <TraceMetaDataHeader
            rootEventResults={rootEventResults}
            tree={tree}
            metaResults={meta}
            organization={organization}
            traceSlug={traceSlug}
            traceEventView={traceEventView}
            logs={logsData}
          />
          <TraceInnerLayout ref={traceInnerLayoutRef}>
            <TraceTabsAndVitals
              tabsConfig={{
                tabOptions,
                currentTab,
                onTabChange,
              }}
              rootEventResults={rootEventResults}
              tree={tree}
            />
            <TabsWaterfallWrapper visible={currentTab === TraceLayoutTabKeys.WATERFALL}>
              <TraceWaterfall
                tree={tree}
                trace={trace}
                meta={meta}
                replay={null}
                source="performance"
                rootEventResults={rootEventResults}
                traceSlug={traceSlug}
                traceEventView={traceEventView}
                organization={organization}
                hideIfNoData={hideTraceWaterfallIfEmpty}
                traceWaterfallScrollHandlers={traceWaterfallScroll}
                traceWaterfallModels={traceWaterfallModels}
              />
            </TabsWaterfallWrapper>
            {currentTab === TraceLayoutTabKeys.PROFILES ? (
              <TraceProfiles tree={tree} />
            ) : null}
            {currentTab === TraceLayoutTabKeys.LOGS ? (
              <TraceViewLogsSection scrollContainer={traceInnerLayoutRef} />
            ) : null}
            {currentTab === TraceLayoutTabKeys.SUMMARY ? (
              <TraceSummarySection traceSlug={traceSlug} />
            ) : null}
            {currentTab === TraceLayoutTabKeys.AI_SPANS ? (
              <TraceAiSpans
                traceSlug={traceSlug}
                viewManager={traceWaterfallModels.viewManager}
              />
            ) : null}
          </TraceInnerLayout>
        </TraceExternalLayout>
      </NoProjectMessage>
    </SentryDocumentTitle>
  );
}

const TabsWaterfallWrapper = styled('div')<{visible: boolean}>`
  display: ${p => (p.visible ? 'flex' : 'none')};
  flex-direction: column;
  flex: 1 1 100%;
`;

const TraceExternalLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  max-height: 100vh;

  ~ footer {
    display: none;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const TraceInnerLayout = styled(FlexBox)`
  padding: ${space(2)} ${space(3)};
  flex-grow: 1;
  overflow-y: auto;
`;
