import React from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DomainTransactionsTable,
  isAValidSort,
} from 'sentry/views/performance/http/domainTransactionsTable';
import {DurationChart} from 'sentry/views/performance/http/durationChart';
import {ResponseRateChart} from 'sentry/views/performance/http/responseRateChart';
import {ThroughputChart} from 'sentry/views/performance/http/throughputChart';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

type Query = {
  aggregate?: string;
  domain?: string;
};

export function HTTPDomainSummaryPage() {
  const location = useLocation<Query>();
  const organization = useOrganization();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = fromSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const {domain} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': domain,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {data: domainMetrics, isLoading: areDomainMetricsLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      SpanMetricsField.SPAN_DOMAIN,
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      'http_response_rate(3)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
    ],
    enabled: Boolean(domain),
    referrer: 'api.starfish.http-module-domain-summary-metrics-ribbon',
  });

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['spm()'],
    enabled: Boolean(domain),
    referrer: 'api.starfish.http-module-domain-summary-throughput-chart',
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
    enabled: Boolean(domain),
    referrer: 'api.starfish.http-module-domain-summary-duration-chart',
  });

  const {
    isLoading: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
    referrer: 'api.starfish.http-module-domain-summary-response-code-chart',
  });

  const {
    isLoading: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      'transaction',
      'transaction.method',
      'spm()',
      'http_response_rate(2)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      'avg(span.self_time)',
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [sort],
    limit: TRANSACTIONS_TABLE_ROW_COUNT,
    cursor,
    referrer: 'api.starfish.http-module-domain-summary-transactions-list',
  });

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'HTTP',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/http`),
                preservePageFilters: true,
              },
              {
                label: 'Domain Summary',
              },
            ]}
          />
          <Layout.Title>{domain}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <HeaderContainer>
                <PageFilterBar condensed>
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>

                <MetricsRibbon>
                  <MetricReadout
                    title={getThroughputTitle('http')}
                    value={domainMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                    unit={RateUnit.PER_MINUTE}
                    isLoading={areDomainMetricsLoading}
                  />

                  <MetricReadout
                    title={DataTitles.avg}
                    value={
                      domainMetrics?.[0]?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]
                    }
                    unit={DurationUnit.MILLISECOND}
                    isLoading={areDomainMetricsLoading}
                  />

                  <MetricReadout
                    title={t('3XXs')}
                    value={domainMetrics?.[0]?.[`http_response_rate(3)`]}
                    unit="percentage"
                    isLoading={areDomainMetricsLoading}
                  />

                  <MetricReadout
                    title={t('4XXs')}
                    value={domainMetrics?.[0]?.[`http_response_rate(4)`]}
                    unit="percentage"
                    isLoading={areDomainMetricsLoading}
                  />

                  <MetricReadout
                    title={t('5XXs')}
                    value={domainMetrics?.[0]?.[`http_response_rate(5)`]}
                    unit="percentage"
                    isLoading={areDomainMetricsLoading}
                  />

                  <MetricReadout
                    title={DataTitles.timeSpent}
                    value={domainMetrics?.[0]?.['sum(span.self_time)']}
                    unit={DurationUnit.MILLISECOND}
                    tooltip={getTimeSpentExplanation(
                      domainMetrics?.[0]?.['time_spent_percentage()'],
                      'db'
                    )}
                    isLoading={areDomainMetricsLoading}
                  />
                </MetricsRibbon>
              </HeaderContainer>
            </ModuleLayout.Full>

            <ModuleLayout.Third>
              <ThroughputChart
                series={throughputData['spm()']}
                isLoading={isThroughputDataLoading}
                error={throughputError}
              />
            </ModuleLayout.Third>

            <ModuleLayout.Third>
              <DurationChart
                series={durationData[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
                isLoading={isDurationDataLoading}
                error={durationError}
              />
            </ModuleLayout.Third>

            <ModuleLayout.Third>
              <ResponseRateChart
                series={[
                  {
                    ...responseCodeData[`http_response_rate(3)`],
                    seriesName: t('3XX'),
                  },
                  {
                    ...responseCodeData[`http_response_rate(4)`],
                    seriesName: t('4XX'),
                  },
                  {
                    ...responseCodeData[`http_response_rate(5)`],
                    seriesName: t('5XX'),
                  },
                ]}
                isLoading={isResponseCodeDataLoading}
                error={responseCodeError}
              />
            </ModuleLayout.Third>

            <ModuleLayout.Full>
              <DomainTransactionsTable
                domain={domain}
                data={transactionsList}
                error={transactionsListError}
                isLoading={isTransactionsListLoading}
                meta={transactionsListMeta}
                pageLinks={transactionsListPageLinks}
                sort={sort}
              />
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      baseURL="/performance/http"
      title={[t('Performance'), t('HTTP'), t('Domain Summary')].join(' — ')}
      features="performance-http-view"
    >
      <HTTPDomainSummaryPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
