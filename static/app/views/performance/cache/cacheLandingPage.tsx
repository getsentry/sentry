import React, {Fragment, useEffect} from 'react';
import keyBy from 'lodash/keyBy';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  DismissId,
  PageAlert,
  PageAlertProvider,
  usePageAlert,
} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {CacheHitMissChart} from 'sentry/views/performance/cache/charts/hitMissChart';
import {ThroughputChart} from 'sentry/views/performance/cache/charts/throughputChart';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {CacheSamplePanel} from 'sentry/views/performance/cache/samplePanel/samplePanel';
import {
  BASE_FILTERS,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
  ONBOARDING_CONTENT,
} from 'sentry/views/performance/cache/settings';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/performance/cache/tables/transactionsTable';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/performance/onboarding/modulesOnboarding';
import {OnboardingContent} from 'sentry/views/performance/onboarding/onboardingContent';
import {useHasData} from 'sentry/views/performance/onboarding/useHasData';
import {useHasDataTrackAnalytics} from 'sentry/views/performance/utils/analytics/useHasDataTrackAnalytics';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {useMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {CACHE_MISS_RATE} = SpanFunction;
const {CACHE_ITEM_SIZE} = SpanMetricsField;

const SDK_UPDATE_ALERT = (
  <Fragment>
    {t(
      `If you're noticing missing cache data, try updating to the latest SDK or ensure spans are manually instrumented with the right attributes. To learn more, `
    )}
    <ExternalLink href={`${MODULE_DOC_LINK}#instrumentation`}>
      {t('Read the Docs')}
    </ExternalLink>
  </Fragment>
);

const CACHE_ERROR_MESSAGE = 'Column cache.hit was not found in metrics indexer';

export function CacheLandingPage() {
  const location = useLocation();
  const {setPageInfo, pageAlert} = usePageAlert();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {
    isLoading: isCacheMissRateLoading,
    data: cacheMissRateData,
    error: cacheMissRateError,
  } = useSpanMetricsSeries(
    {
      yAxis: [`${CACHE_MISS_RATE}()`],
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
    },
    Referrer.LANDING_CACHE_HIT_MISS_CHART
  );

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      yAxis: ['spm()'],
    },
    Referrer.LANDING_CACHE_THROUGHPUT_CHART
  );

  const {
    isFetching: isTransactionsListFetching,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      fields: [
        'project',
        'project.id',
        'transaction',
        'spm()',
        `${CACHE_MISS_RATE}()`,
        'sum(span.self_time)',
        'time_spent_percentage()',
        `avg(${CACHE_ITEM_SIZE})`,
      ],
      sorts: [sort],
      cursor,
      limit: TRANSACTIONS_TABLE_ROW_COUNT,
    },
    Referrer.LANDING_CACHE_TRANSACTION_LIST
  );

  const {
    data: transactionDurationData,
    error: transactionDurationError,
    meta: transactionDurationMeta,
    isFetching: isTransactionDurationFetching,
  } = useMetrics(
    {
      search: `transaction:[${transactionsList.map(({transaction}) => `"${transaction}"`).join(',')}]`,
      fields: [`avg(transaction.duration)`, 'transaction'],
      enabled: !isTransactionsListFetching && transactionsList.length > 0,
    },
    Referrer.LANDING_CACHE_TRANSACTION_DURATION
  );

  const onboardingProject = useOnboardingProject();
  const {hasData, isLoading: isHasDataLoading} = useHasData(
    MutableSearch.fromQueryObject(BASE_FILTERS),
    Referrer.LANDING_CACHE_ONBOARDING
  );

  useHasDataTrackAnalytics(
    MutableSearch.fromQueryObject(BASE_FILTERS),
    Referrer.LANDING_CACHE_ONBOARDING,
    'insight.page_loads.cache'
  );

  useEffect(() => {
    const hasMissingDataError =
      cacheMissRateError?.message === CACHE_ERROR_MESSAGE ||
      transactionsListError?.message === CACHE_ERROR_MESSAGE;

    if (onboardingProject || isHasDataLoading || !hasData) {
      setPageInfo(undefined);
      return;
    }
    if (pageAlert?.message !== SDK_UPDATE_ALERT) {
      if (hasMissingDataError && hasData && !isHasDataLoading) {
        setPageInfo(SDK_UPDATE_ALERT, {dismissId: DismissId.CACHE_SDK_UPDATE_ALERT});
      }
    }
  }, [
    cacheMissRateError?.message,
    transactionsListError?.message,
    setPageInfo,
    hasData,
    isHasDataLoading,
    pageAlert?.message,
    onboardingProject,
  ]);

  const transactionDurationsMap = keyBy(transactionDurationData, 'transaction');

  const transactionsListWithDuration =
    transactionsList?.map(transaction => ({
      ...transaction,
      'avg(transaction.duration)':
        transactionDurationsMap[transaction.transaction]?.['avg(transaction.duration)'],
    })) || [];

  const meta = combineMeta(transactionsListMeta, transactionDurationMeta);

  addCustomMeta(meta);

  const crumbs = useModuleBreadcrumbs('cache');

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />

          <Layout.Title>
            {MODULE_TITLE}
            <PageHeadingQuestionTooltip
              docsUrl={MODULE_DOC_LINK}
              title={MODULE_DESCRIPTION}
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <PageAlert />
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ModuleLayout.Full>
            <ModulesOnboarding
              moduleQueryFilter={MutableSearch.fromQueryObject(BASE_FILTERS)}
              onboardingContent={<OnboardingContent {...ONBOARDING_CONTENT} />}
              referrer={Referrer.LANDING_CACHE_ONBOARDING}
            >
              <ModuleLayout.Half>
                <CacheHitMissChart
                  series={{
                    seriesName: DataTitles[`${CACHE_MISS_RATE}()`],
                    data: cacheMissRateData[`${CACHE_MISS_RATE}()`]?.data,
                  }}
                  isLoading={isCacheMissRateLoading}
                  error={cacheMissRateError}
                />
              </ModuleLayout.Half>
              <ModuleLayout.Half>
                <ThroughputChart
                  series={throughputData['spm()']}
                  isLoading={isThroughputDataLoading}
                  error={throughputError}
                />
              </ModuleLayout.Half>
              <ModuleLayout.Full>
                <TransactionsTable
                  data={transactionsListWithDuration}
                  isLoading={isTransactionsListFetching || isTransactionDurationFetching}
                  sort={sort}
                  error={transactionsListError || transactionDurationError}
                  meta={meta}
                  pageLinks={transactionsListPageLinks}
                />
              </ModuleLayout.Full>
            </ModulesOnboarding>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
      <CacheSamplePanel />
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="cache" features="insights-addon-modules">
      <PageAlertProvider>
        <CacheLandingPage />
      </PageAlertProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const combineMeta = (
  meta1?: EventsMetaType,
  meta2?: EventsMetaType
): EventsMetaType | undefined => {
  if (!meta1 && !meta2) {
    return undefined;
  }
  if (!meta1) {
    return meta2;
  }
  if (!meta2) {
    return meta1;
  }
  return {
    fields: {...meta1.fields, ...meta2.fields},
    units: {...meta1.units, ...meta2.units},
  };
};

// TODO - this should come from the backend
const addCustomMeta = (meta?: EventsMetaType) => {
  if (meta) {
    meta.fields[`avg(${CACHE_ITEM_SIZE})`] = 'size';
    meta.units[`avg(${CACHE_ITEM_SIZE})`] = 'byte';
  }
};

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;
