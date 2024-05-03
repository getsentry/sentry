import React from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CacheHitMissChart} from 'sentry/views/performance/cache/charts/hitMissChart';
import {ThroughputChart} from 'sentry/views/performance/cache/charts/throughputChart';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {CacheSamplePanel} from 'sentry/views/performance/cache/samplePanel/samplePanel';
import {
  BASE_FILTERS,
  CACHE_BASE_URL,
  MODULE_TITLE,
  RELEASE_LEVEL,
} from 'sentry/views/performance/cache/settings';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/performance/cache/tables/transactionsTable';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanFunction} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const {CACHE_MISS_RATE} = SpanFunction;

export function CacheLandingPage() {
  const organization = useOrganization();
  const location = useLocation();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {
    isLoading: isCacheHitRateLoading,
    data: cacheHitRateData,
    error: cacheHitRateError,
  } = useSpanMetricsSeries({
    yAxis: [`${CACHE_MISS_RATE}()`],
    search: MutableSearch.fromQueryObject(BASE_FILTERS),
    referrer: Referrer.LANDING_CACHE_HIT_MISS_CHART,
  });

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(BASE_FILTERS),
    yAxis: ['spm()'],
    referrer: Referrer.LANDING_CACHE_THROUGHPUT_CHART,
  });

  const {
    isLoading: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(BASE_FILTERS),
    fields: [
      'project',
      'project.id',
      'transaction',
      'spm()',
      `${CACHE_MISS_RATE}()`,
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [sort],
    cursor,
    limit: TRANSACTIONS_TABLE_ROW_COUNT,
    referrer: Referrer.LANDING_CACHE_TRANSACTION_LIST,
  });

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: MODULE_TITLE,
              },
            ]}
          />

          <Layout.Title>
            {MODULE_TITLE}
            <FeatureBadge type={RELEASE_LEVEL} />
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
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ModuleLayout.Full>
            <ModuleLayout.Half>
              <CacheHitMissChart
                series={cacheHitRateData[`${CACHE_MISS_RATE}()`]}
                isLoading={isCacheHitRateLoading}
                error={cacheHitRateError}
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
                data={transactionsList}
                isLoading={isTransactionsListLoading}
                sort={sort}
                error={transactionsListError}
                meta={transactionsListMeta}
                pageLinks={transactionsListPageLinks}
              />
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
      <CacheSamplePanel />
    </React.Fragment>
  );
}

export function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL={CACHE_BASE_URL}
      features="performance-cache-view"
    >
      <CacheLandingPage />
    </ModulePageProviders>
  );
}

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;

export default LandingPageWithProviders;
