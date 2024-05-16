import React from 'react';
import keyBy from 'lodash/keyBy';

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
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
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
  BASE_URL,
  MODULE_TITLE,
  ONBOARDING_CONTENT,
  RELEASE_LEVEL,
} from 'sentry/views/performance/cache/settings';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/performance/cache/tables/transactionsTable';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/performance/onboarding/modulesOnboarding';
import {OnboardingContent} from 'sentry/views/performance/onboarding/onboardingContent';
import {useMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {CACHE_MISS_RATE} = SpanFunction;
const {CACHE_ITEM_SIZE} = SpanMetricsField;

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
    isLoading: isTransactionsListLoading,
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
    isLoading: isTransactionDurationLoading,
  } = useMetrics(
    {
      search: `transaction:[${transactionsList.map(({transaction}) => `"${transaction}"`).join(',')}]`,
      fields: [`avg(transaction.duration)`, 'transaction'],
      enabled: !isTransactionsListLoading && transactionsList.length > 0,
    },
    Referrer.LANDING_CACHE_TRANSACTION_DURATION
  );

  const transactionDurationsMap = keyBy(transactionDurationData, 'transaction');

  const transactionsListWithDuration =
    transactionsList?.map(transaction => ({
      ...transaction,
      'avg(transaction.duration)':
        transactionDurationsMap[transaction.transaction]?.['avg(transaction.duration)'],
    })) || [];

  const meta = combineMeta(transactionsListMeta, transactionDurationMeta);

  addCustomMeta(meta);

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
            <ModulesOnboarding
              moduleQueryFilter={MutableSearch.fromQueryObject(BASE_FILTERS)}
              onboardingContent={<OnboardingContent {...ONBOARDING_CONTENT} />}
              referrer={Referrer.LANDING_CACHE_ONBOARDING}
            >
              <ModuleLayout.Half>
                <CacheHitMissChart
                  series={{
                    seriesName: DataTitles.cacheMissRate,
                    data: cacheHitRateData[`${CACHE_MISS_RATE}()`]?.data,
                  }}
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
                  data={transactionsListWithDuration}
                  isLoading={isTransactionsListLoading || isTransactionDurationLoading}
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
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL={`/performance/${BASE_URL}`}
      features="performance-cache-view"
    >
      <CacheLandingPage />
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
