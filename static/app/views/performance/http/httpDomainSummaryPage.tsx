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
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useSelectedDurationAggregate} from 'sentry/views/performance/database/useSelectedDurationAggregate';
import {DomainTransactionsTable} from 'sentry/views/performance/http/domainTransactionsTable';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {ModuleName, SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

type Query = {
  aggregate?: string;
  domain?: string;
};

export function HTTPDomainSummaryPage() {
  const location = useLocation<Query>();
  const organization = useOrganization();

  const [selectedAggregate] = useSelectedDurationAggregate();

  const {domain} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': domain,
  };

  const {data: domainMetrics, isLoading: areDomainMetricsLoading} = useSpanMetrics({
    filters,
    fields: [
      SpanMetricsField.SPAN_DOMAIN,
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
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
    filters,
    yAxis: ['spm()'],
    enabled: Boolean(domain),
    referrer: 'api.starfish.http-module-domain-summary-throughput-chart',
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    filters,
    yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    enabled: Boolean(domain),
    referrer: 'api.starfish.http-module-domain-summary-duration-chart',
  });

  const {
    isLoading: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
  } = useSpanMetrics({
    filters,
    fields: [
      'transaction',
      'spm()',
      'http_response_rate(2)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      'avg(span.self_time)',
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [],
    limit: TRANSACTIONS_TABLE_ROW_COUNT,
    cursor: '',
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
                      domainMetrics?.[0]?.[
                        `${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`
                      ]
                    }
                    unit={DurationUnit.MILLISECOND}
                    isLoading={areDomainMetricsLoading}
                  />
                </MetricsRibbon>
              </HeaderContainer>
            </ModuleLayout.Full>

            <ModuleLayout.Half>
              <ThroughputChart
                series={throughputData['spm()']}
                isLoading={isThroughputDataLoading}
                error={throughputError}
              />
            </ModuleLayout.Half>

            <ModuleLayout.Half>
              <DurationChart
                series={
                  durationData[`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`]
                }
                isLoading={isDurationDataLoading}
                error={durationError}
              />
            </ModuleLayout.Half>

            <ModuleLayout.Full>
              <DomainTransactionsTable
                data={transactionsList}
                error={transactionsListError}
                isLoading={isTransactionsListLoading}
                meta={transactionsListMeta}
              />
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

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
