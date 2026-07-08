import {useEffect, useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceAiTab} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiTab';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {
  TraceViewMetricsProviderWrapper,
  TraceViewMetricsSection,
} from 'sentry/views/performance/newTraceDetails/traceMetrics';
import {
  TraceViewLogsDataProvider,
  TraceViewLogsSection,
} from 'sentry/views/performance/newTraceDetails/traceOurlogs';
import {TraceTabsAndVitals} from 'sentry/views/performance/newTraceDetails/traceTabsAndVitals';
import {PartialTraceDataWarning} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/partialTraceDataWarning';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {
  TraceLayoutTabKeys,
  useTraceLayoutTabs,
} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

import {useTrace} from './traceApi/useTrace';
import {
  getTraceMetaErrorCount,
  getTraceMetaMetricsCount,
  getTraceMetaPerformanceIssueCount,
  getTraceMetaSpanCount,
  useTraceMeta,
} from './traceApi/useTraceMeta';
import {useTraceRootEvent} from './traceApi/useTraceRootEvent';
import {useTraceTree} from './traceApi/useTraceTree';
import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  getInitialTracePreferences,
  TRACE_WATERFALL_TIME_COMPRESSION_FEATURE,
} from './traceState/tracePreferences';
import {TraceStateProvider} from './traceState/traceStateProvider';
import {ErrorsOnlyWarnings} from './traceTypeWarnings/errorsOnlyWarnings';
import {TraceMetaDataHeader} from './traceHeader';
import {useInitialTraceMetricData} from './useInitialTraceMetricData';
import {useTraceEventView} from './useTraceEventView';
import {useTraceQueryParams} from './useTraceQueryParams';
import {useTraceStateAnalytics} from './useTraceStateAnalytics';

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

export default function TraceView() {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = useMemo(() => decodeTraceSlug(params.traceSlug), [params.traceSlug]);
  const enableCompressedTimeline = organization.features.includes(
    TRACE_WATERFALL_TIME_COMPRESSION_FEATURE
  );

  const preferences = useMemo(
    () =>
      getInitialTracePreferences(
        TRACE_VIEW_PREFERENCES_KEY,
        DEFAULT_TRACE_VIEW_PREFERENCES,
        'trace_view',
        {enableCompressedTimeline}
      ),
    [enableCompressedTimeline]
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

function TraceViewImplInner({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const logsEnabled = isLogsEnabled(organization);
  const metricsEnabled = canUseMetricsUI(organization);
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);
  const logsData = useInitialLogsData();
  const meta = useTraceMeta({traceSlug, timestamp: queryParams.timestamp});
  const metaMetricsCount = getTraceMetaMetricsCount(meta.data);
  const {metricsData} = useInitialTraceMetricData({
    traceId: traceSlug,
    queryParams,
    enabled: meta.status !== 'pending' && metaMetricsCount === undefined,
  });
  const traceMetricsData =
    metaMetricsCount === undefined ? metricsData : {count: metaMetricsCount};
  const hideTraceWaterfallIfEmpty = (logsData?.length ?? 0) > 0;

  const trace = useTrace({
    traceSlug,
    timestamp: queryParams.timestamp,
    additionalAttributes: [
      'thread.id',
      'tags[performance.timeOrigin,number]',
      'gen_ai.operation.type',
      'http.response.status_code',
      'span.status',
    ],
  });
  const tree = useTraceTree({traceSlug, trace, replay: null});

  useTraceStateAnalytics({
    trace,
    meta,
    organization,
    traceTreeSource: 'trace_view',
    tree,
  });

  const rootEventResults = useTraceRootEvent({
    tree,
    logs: logsData,
    timestamp: queryParams.timestamp,
    traceId: traceSlug,
  });

  const {tabOptions, currentTab, onTabChange} = useTraceLayoutTabs({
    isLoading: meta.status === 'pending' || tree.type === 'loading',
    tree,
    logs: logsData,
    meta: meta.data,
    metrics: traceMetricsData,
    logsEnabled,
    metricsEnabled,
  });

  // Push trace metadata into the LLM context tree for Seer Explorer.
  useLLMContext({
    contextHint:
      'Sentry trace detail page. services lists the projects (services) involved in this trace. ' +
      'You can get the trace waterfall or focus on a specific span, get event details or issue aggregate stats, ' +
      'get log attributes or metric attributes by trace ID, view a profile flamegraph, ' +
      'and search live telemetry for related spans/errors/logs/metrics.',
    traceId: traceSlug,
    activeTab: currentTab,
    durationMs: tree.root.children[0]?.space?.[1],
    nodeCount: tree.list.length,
    services: Array.from(tree.projects.values()).map(p => p.slug),
    errors: getTraceMetaErrorCount(meta.data),
    performanceIssues: getTraceMetaPerformanceIssueCount(meta.data),
    spanCount: getTraceMetaSpanCount(meta.data),
    webVitals: tree.indicators.map(i => ({
      type: i.type,
      label: i.label,
      value: i.measurement.value,
      unit: i.measurement.unit,
      poor: i.poor,
    })),
  });

  return (
    <SentryDocumentTitle
      title={`${t('Trace Details')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <NoProjectMessage organization={organization}>
        <ViewportConstrainedPage>
          <TraceMetaDataHeader
            rootEventResults={rootEventResults}
            tree={tree}
            metaResults={meta}
            organization={organization}
            traceSlug={traceSlug}
            logs={logsData}
            metrics={traceMetricsData}
          />
          <TraceInnerLayout>
            <ErrorsOnlyWarnings
              tree={tree}
              traceSlug={traceSlug}
              organization={organization}
            />
            <PartialTraceDataWarning
              timestamp={queryParams.timestamp}
              logs={logsData}
              tree={tree}
            />
            <TraceTabsAndVitals
              tabsConfig={{
                tabOptions,
                currentTab,
                onTabChange,
              }}
              rootEventResults={rootEventResults}
              tree={tree}
            />
            {currentTab === TraceLayoutTabKeys.WATERFALL ? (
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
              />
            ) : null}
            {currentTab === TraceLayoutTabKeys.PROFILES ? (
              <TraceProfiles tree={tree} />
            ) : null}
            {currentTab === TraceLayoutTabKeys.LOGS ? <TraceViewLogsSection /> : null}
            {currentTab === TraceLayoutTabKeys.METRICS ? (
              <TraceViewMetricsProviderWrapper traceSlug={traceSlug}>
                <TraceViewMetricsSection />
              </TraceViewMetricsProviderWrapper>
            ) : null}
            {currentTab === TraceLayoutTabKeys.AI_SPANS ? (
              <TraceAiTab traceSlug={traceSlug} />
            ) : null}
          </TraceInnerLayout>
        </ViewportConstrainedPage>
      </NoProjectMessage>
    </SentryDocumentTitle>
  );
}

const TraceViewImpl = registerLLMContext('trace', TraceViewImplInner);

function TraceInnerLayout(props: FlexProps) {
  return (
    <Flex
      {...props}
      background="primary"
      direction="column"
      gap="md"
      paddingLeft="xl"
      paddingRight="xl"
      paddingTop="lg"
      paddingBottom="lg"
      flex="1"
      overflowY="auto"
    />
  );
}
