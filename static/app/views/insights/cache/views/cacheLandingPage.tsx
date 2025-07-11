import React, {Fragment, useEffect} from 'react';
import keyBy from 'lodash/keyBy';

import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
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
import {CacheSamplePanel} from 'sentry/views/insights/cache/components/samplePanel';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/insights/cache/components/tables/transactionsTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS, MODULE_DOC_LINK} from 'sentry/views/insights/cache/settings';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import CacheMissRateChartWidget from 'sentry/views/insights/common/components/widgets/cacheMissRateChartWidget';
import CacheThroughputChartWidget from 'sentry/views/insights/common/components/widgets/cacheThroughputChartWidget';
import {
  useMetrics,
  useSpanMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {combineMeta} from 'sentry/views/insights/common/utils/combineMeta';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
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

  const sort = decodeSorts(sortField).find(isAValidSort) ?? DEFAULT_SORT;
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  useSamplesDrawer({
    Component: <CacheSamplePanel />,
    moduleName: ModuleName.CACHE,
    requiredParams: ['transaction'],
  });

  const {error: cacheMissRateError} = useSpanMetricsSeries(
    {
      yAxis: [`${CACHE_MISS_RATE}()`],
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_CACHE_HIT_MISS_CHART
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
        'epm()',
        `${CACHE_MISS_RATE}()`,
        'sum(span.self_time)',
        `avg(${CACHE_ITEM_SIZE})`,
      ],
      sorts: [sort],
      cursor,
      limit: TRANSACTIONS_TABLE_ROW_COUNT,
    },
    Referrer.LANDING_CACHE_TRANSACTION_LIST
  );

  const search = `transaction:[${transactionsList.map(({transaction}) => `"${transaction.replaceAll('"', '\\"')}"`).join(',')}] AND is_transaction:true`;

  const {
    data: transactionDurationData,
    error: transactionDurationError,
    meta: transactionDurationMeta,
    isFetching: isTransactionDurationFetching,
  } = useMetrics(
    {
      search,
      fields: ['avg(span.duration)', 'transaction'],
      enabled: !isTransactionsListFetching && transactionsList.length > 0,
      noPagination: true,
    },
    Referrer.LANDING_CACHE_TRANSACTION_DURATION
  );

  const onboardingProject = useOnboardingProject();
  const hasData = useHasFirstSpan(ModuleName.CACHE);

  useEffect(() => {
    // TODO: EAP does not use an indexer, so these metrics indexer errors are not possible. When EAP is fully rolled out, remove this check.
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
      'avg(span.duration)':
        transactionDurationsMap[transaction.transaction]?.['avg(span.duration)']!,
    })) || [];

  const meta = combineMeta(transactionsListMeta, transactionDurationMeta);
  addCustomMeta(meta);

  return (
    <React.Fragment>
      <BackendHeader module={ModuleName.CACHE} />

      <ModuleBodyUpsellHook moduleName={ModuleName.CACHE}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ModulePageFilterBar moduleName={ModuleName.CACHE} />
              </ModuleLayout.Full>
              <ModulesOnboarding moduleName={ModuleName.CACHE}>
                <ModuleLayout.Half>
                  <CacheMissRateChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Half>
                  <CacheThroughputChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Full>
                  <TransactionsTable
                    data={transactionsListWithDuration}
                    isLoading={
                      isTransactionsListFetching || isTransactionDurationFetching
                    }
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
      </ModuleBodyUpsellHook>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="cache" analyticEventName="insight.page_loads.cache">
      <PageAlertProvider>
        <CacheLandingPage />
      </PageAlertProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;

// TODO - this won't be needed once we migrate to EAP
const addCustomMeta = (meta?: EventsMetaType) => {
  if (meta?.fields) {
    meta.fields[`avg(${CACHE_ITEM_SIZE})`] = 'size';
    meta.fields[`avg(span.duration)`] = 'duration';
    meta.units[`avg(${CACHE_ITEM_SIZE})`] = 'byte';
  }

  if (meta?.units) {
    meta.units[`avg(span.duration)`] = 'millisecond';
  }
};

const DEFAULT_SORT = {
  field: 'sum(span.self_time)' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;
