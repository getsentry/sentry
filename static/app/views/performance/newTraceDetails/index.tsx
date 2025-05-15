import {Fragment, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import type {UseExploreLogsTableResult} from 'sentry/views/explore/logs/useLogsQuery';
import {TraceContextPanel} from 'sentry/views/performance/newTraceDetails/traceContextPanel';
import {TraceContextTags} from 'sentry/views/performance/newTraceDetails/traceContextTags';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {
  TraceViewLogsDataProvider,
  TraceViewLogsSection,
} from 'sentry/views/performance/newTraceDetails/traceOurlogs';
import {TraceSummarySection} from 'sentry/views/performance/newTraceDetails/traceSummary';
import {TraceTabsAndVitals} from 'sentry/views/performance/newTraceDetails/traceTabsAndVitals';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {useHasTraceTabsUI} from 'sentry/views/performance/newTraceDetails/useHasTraceTabsUI';
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
      Sentry.captureMessage(`Trace slug is empty`);
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

// We only load logs data here to determine if a trace has associated logs and use the first log
// to represent only-logs traces. The embedded logs components fetch their own data and support
// pagination.
function useInitialLogsData() {
  const logsTableData = useLogsPageData();
  const logsData = useRef<UseExploreLogsTableResult | undefined>(undefined);

  useEffect(() => {
    if (logsTableData.logsData.data && !logsData.current?.data.length) {
      logsData.current = logsTableData.logsData;
    }
  }, [logsTableData]);

  return logsData.current;
}

function TraceViewImpl({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);
  const logsData = useInitialLogsData();
  const hideTraceWaterfallIfEmpty = (logsData?.data.length ?? 0) > 0;
  const hasTraceTabsUI = useHasTraceTabsUI();

  const meta = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const trace = useTrace({traceSlug, timestamp: queryParams.timestamp});
  const tree = useTraceTree({traceSlug, trace, meta, replay: null});
  const rootEventResults = useTraceRootEvent({
    tree,
    logs: logsData?.data,
    traceId: traceSlug,
  });

  const traceWaterfallModels = useTraceWaterfallModels();
  const traceWaterfallScroll = useTraceWaterfallScroll({
    organization,
    tree,
    viewManager: traceWaterfallModels.viewManager,
  });

  const {tabOptions, currentTab, onTabChange} = useTraceLayoutTabs({
    tree,
    rootEventResults,
    logs: logsData?.data,
  });

  const legacyTraceInnerContent = (
    <FlexBox>
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
      <TraceContextPanel
        traceSlug={traceSlug}
        tree={tree}
        rootEventResults={rootEventResults}
        onScrollToNode={traceWaterfallScroll.onScrollToNode}
        logs={logsData?.data}
      />
    </FlexBox>
  );

  const traceInnerContent = (
    <Fragment>
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
      {currentTab === TraceLayoutTabKeys.TAGS ||
      currentTab === TraceLayoutTabKeys.ATTRIBUTES ? (
        <TraceContextTags rootEventResults={rootEventResults} />
      ) : null}
      {currentTab === TraceLayoutTabKeys.PROFILES ? (
        <TraceProfiles tree={tree} onScrollToNode={traceWaterfallScroll.onScrollToNode} />
      ) : null}
      {currentTab === TraceLayoutTabKeys.LOGS ? <TraceViewLogsSection /> : null}
      {currentTab === TraceLayoutTabKeys.SUMMARY ? (
        <TraceSummarySection traceSlug={traceSlug} />
      ) : null}
    </Fragment>
  );

  return (
    <SentryDocumentTitle
      title={`${t('Trace Details')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <TraceViewLogsDataProvider traceSlug={traceSlug}>
        <NoProjectMessage organization={organization}>
          <TraceExternalLayout>
            <TraceMetaDataHeader
              rootEventResults={rootEventResults}
              tree={tree}
              metaResults={meta}
              organization={organization}
              traceSlug={traceSlug}
              traceEventView={traceEventView}
              logs={logsData?.data}
            />
            <TraceInnerLayout>
              {hasTraceTabsUI ? traceInnerContent : legacyTraceInnerContent}
            </TraceInnerLayout>
          </TraceExternalLayout>
        </NoProjectMessage>
      </TraceViewLogsDataProvider>
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
  flex: 1 1 100%;
  padding: ${space(2)} ${space(3)};
  overflow-y: scroll;
`;
