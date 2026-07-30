import {Fragment, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack, type FlexProps} from '@sentry/scraps/layout';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceAiTab} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiTab';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {
  TraceViewMetricsProviderWrapper,
  TraceViewMetricsSection,
} from 'sentry/views/performance/newTraceDetails/traceMetrics';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  TraceViewLogsPageDataProvider,
  TraceViewLogsQueryParamsProvider,
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
import {useTraceEventView} from './useTraceEventView';
import {useTraceOverviewData} from './useTraceOverviewData';
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
    <TraceViewLogsQueryParamsProvider traceSlug={traceSlug}>
      <TraceStateProvider
        initialPreferences={preferences}
        preferencesStorageKey={TRACE_VIEW_PREFERENCES_KEY}
      >
        <TraceViewImpl traceSlug={traceSlug} />
      </TraceStateProvider>
    </TraceViewLogsQueryParamsProvider>
  );
}

function TraceViewImplInner({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const logsEnabled = isLogsEnabled(organization);
  const metricsEnabled = canUseMetricsUI(organization);
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);
  const meta = useTraceMeta({traceSlug, timestamp: queryParams.timestamp});

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
  const overview = useTraceOverviewData({
    logsEnabled,
    meta: meta.data,
    metricsEnabled,
    queryParams,
    traceSlug,
    tree,
  });
  useTraceStateAnalytics({
    trace,
    meta,
    organization,
    traceTreeSource: 'trace_view',
    tree,
  });

  const rootEventResults = useTraceRootEvent({
    tree,
    logs: overview.logs.representative,
    timestamp: queryParams.timestamp,
    traceId: traceSlug,
  });

  const tabsConfig = useTraceLayoutTabs({
    isLoading:
      meta.status === 'pending' || tree.type === 'loading' || overview.isTabLoading,
    tree,
    meta: meta.data,
    logsEnabled,
    metricsEnabled,
    overview,
  });
  const {currentTab} = tabsConfig;
  const isResolvingEmptyTraceTab = tree.type === 'empty' && tabsConfig.isLoading;

  const traceNode = tree.root.children[0];
  const traceErrors = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const errorsByEventId = new Map<string, TraceTree.TraceErrorIssue>();
    for (const error of traceNode.errors) {
      errorsByEventId.set(error.event_id, error);
    }

    return Array.from(errorsByEventId.values());
  }, [traceNode]);

  const traceStartMs = traceNode?.space[0] ?? 0;
  const traceStartSeconds = traceStartMs > 0 ? traceStartMs / 1000 : 0;

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

  const content = (
    <ViewportConstrainedPage>
      <TraceMetaDataHeader
        rootEventResults={rootEventResults}
        tree={tree}
        metaResults={meta}
        organization={organization}
        overview={overview}
        traceSlug={traceSlug}
      />
      <TraceInnerLayout>
        <TraceWaterfallVersionBanner />
        <TraceTabsAndVitals
          tabsConfig={tabsConfig}
          rootEventResults={rootEventResults}
          tree={tree}
        />
        {isResolvingEmptyTraceTab ? null : currentTab === TraceLayoutTabKeys.WATERFALL ? (
          <Fragment>
            <ErrorsOnlyWarnings
              tree={tree}
              traceSlug={traceSlug}
              organization={organization}
            />
            <PartialTraceDataWarning
              timestamp={queryParams.timestamp}
              logs={overview.logs.representative}
              tree={tree}
            />
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
              hideIfNoData={false}
            />
          </Fragment>
        ) : currentTab === TraceLayoutTabKeys.PROFILES ? (
          <TraceProfiles tree={tree} />
        ) : currentTab === TraceLayoutTabKeys.LOGS ? (
          <TraceViewLogsPageDataProvider>
            <TraceViewLogsSection
              errors={traceErrors}
              fallbackTimestampSeconds={traceStartSeconds}
            />
          </TraceViewLogsPageDataProvider>
        ) : currentTab === TraceLayoutTabKeys.METRICS ? (
          <TraceViewMetricsProviderWrapper traceSlug={traceSlug}>
            <TraceViewMetricsSection />
          </TraceViewMetricsProviderWrapper>
        ) : currentTab === TraceLayoutTabKeys.AI_SPANS ? (
          <TraceAiTab traceSlug={traceSlug} />
        ) : null}
      </TraceInnerLayout>
    </ViewportConstrainedPage>
  );

  const isInitialTraceLoading =
    Boolean(traceSlug) &&
    (meta.status === 'pending' || trace.status === 'pending' || tree.type === 'loading');

  return (
    <SentryDocumentTitle
      title={`${t('Trace Details')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <TraceProjectGuard
        organization={organization}
        suppressMessage={isInitialTraceLoading}
      >
        {content}
      </TraceProjectGuard>
    </SentryDocumentTitle>
  );
}

const TraceViewImpl = registerLLMContext('trace', TraceViewImplInner);

function TraceProjectGuard({
  children,
  organization,
  suppressMessage,
}: {
  children: React.ReactNode;
  organization: Organization;
  suppressMessage: boolean;
}) {
  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  if (suppressMessage || hasProjectAccess || !projectsLoaded) {
    return <Fragment>{children}</Fragment>;
  }

  return <NoProjectMessage organization={organization}>{children}</NoProjectMessage>;
}

function TraceWaterfallVersionBanner() {
  const organization = useOrganization();
  const openForm = useFeedbackForm();
  const {isDismissed, dismiss} = useDismissAlert({
    key: 'trace-waterfall-version-message',
  });

  if (
    !organization.features.includes('trace-waterfall-version-message') ||
    isDismissed ||
    !openForm
  ) {
    return null;
  }

  return (
    <Alert
      variant="info"
      trailingItems={
        <Alert.Button
          variant="transparent"
          icon={<IconClose size="sm" />}
          onClick={dismiss}
          aria-label={t('Dismiss')}
        />
      }
    >
      {tct(
        "You're seeing a new version of the trace waterfall that shows the full distributed trace. We'd love your [feedback].",
        {
          feedback: (
            <Button
              variant="link"
              onClick={() =>
                openForm({
                  tags: {
                    ['feedback.source']: 'trace-waterfall-version-message',
                    ['feedback.owner']: 'performance',
                  },
                })
              }
            >
              {t('feedback')}
            </Button>
          ),
        }
      )}
    </Alert>
  );
}

function TraceInnerLayout(props: FlexProps) {
  return (
    <Stack
      {...props}
      background="primary"
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
