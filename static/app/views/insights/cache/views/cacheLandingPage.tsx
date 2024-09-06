import React, {Fragment, useEffect} from 'react';
import keyBy from 'lodash/keyBy';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
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
import {CacheHitMissChart} from 'sentry/views/insights/cache/components/charts/hitMissChart';
import {ThroughputChart} from 'sentry/views/insights/cache/components/charts/throughputChart';
import {CacheSamplePanel} from 'sentry/views/insights/cache/components/samplePanel';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/insights/cache/components/tables/transactionsTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {
  BASE_FILTERS,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/cache/settings';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {
  useMetrics,
  useSpanMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

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
    isPending: isCacheMissRateLoading,
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
    isPending: isThroughputDataLoading,
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
      search: `transaction:[${transactionsList.map(({transaction}) => `"${transaction.replaceAll('"', '\\"')}"`).join(',')}]`,
      fields: [`avg(transaction.duration)`, 'transaction'],
      enabled: !isTransactionsListFetching && transactionsList.length > 0,
      noPagination: true,
    },
    Referrer.LANDING_CACHE_TRANSACTION_DURATION
  );

  const onboardingProject = useOnboardingProject();
  const hasData = useHasFirstSpan(ModuleName.CACHE);

  useEffect(() => {
    const hasMissingDataError =
      cacheMissRateError?.message === CACHE_ERROR_MESSAGE ||
      transactionsListError?.message === CACHE_ERROR_MESSAGE;

    if (onboardingProject || !hasData) {
      setPageInfo(undefined);
      return;
    }
    if (pageAlert?.message !== SDK_UPDATE_ALERT) {
      if (hasMissingDataError && hasData) {
        setPageInfo(SDK_UPDATE_ALERT, {dismissId: DismissId.CACHE_SDK_UPDATE_ALERT});
      }
    }
  }, [
    cacheMissRateError?.message,
    transactionsListError?.message,
    setPageInfo,
    hasData,
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
              <ModulePageFilterBar moduleName={ModuleName.CACHE} />
            </ModuleLayout.Full>
            <ModulesOnboarding moduleName={ModuleName.CACHE}>
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
    <ModulePageProviders
      moduleName="cache"
      features="insights-addon-modules"
      analyticEventName="insight.page_loads.cache"
    >
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
