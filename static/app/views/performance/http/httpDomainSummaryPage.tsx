import React from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {
  EMPTY_OPTION_VALUE,
  escapeFilterValue,
  MutableSearch,
} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/http/charts/durationChart';
import {ResponseRateChart} from 'sentry/views/performance/http/charts/responseRateChart';
import {ThroughputChart} from 'sentry/views/performance/http/charts/throughputChart';
import {DomainStatusLink} from 'sentry/views/performance/http/components/domainStatusLink';
import {HTTPSamplesPanel} from 'sentry/views/performance/http/httpSamplesPanel';
import {Referrer} from 'sentry/views/performance/http/referrers';
import {
  MODULE_TITLE,
  NULL_DOMAIN_DESCRIPTION,
  RELEASE_LEVEL,
} from 'sentry/views/performance/http/settings';
import {
  DomainTransactionsTable,
  isAValidSort,
} from 'sentry/views/performance/http/tables/domainTransactionsTable';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
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
  const {projects} = useProjects();

  // TODO: Fetch sort information using `useLocationQuery`
  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const {domain, project: projectId} = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
    },
  });

  const project = projects.find(p => projectId === p.id);

  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(domain),
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {data: domainMetrics, isLoading: areDomainMetricsLoading} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      'http_response_rate(3)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
    ],
    referrer: Referrer.DOMAIN_SUMMARY_METRICS_RIBBON,
  });

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['spm()'],
    referrer: Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART,
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
    referrer: Referrer.DOMAIN_SUMMARY_DURATION_CHART,
  });

  const {
    isLoading: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
    referrer: Referrer.DOMAIN_SUMMARY_RESPONSE_CODE_CHART,
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
      'project.id',
      'transaction',
      'transaction.method',
      'spm()',
      'http_response_rate(3)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      'avg(span.self_time)',
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [sort],
    limit: TRANSACTIONS_TABLE_ROW_COUNT,
    cursor,
    referrer: Referrer.DOMAIN_SUMMARY_TRANSACTIONS_LIST,
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
                label: MODULE_TITLE,
                to: normalizeUrl(`/organizations/${organization.slug}/performance/http`),
                preservePageFilters: true,
              },
              {
                label: 'Domain Summary',
              },
            ]}
          />
          <Layout.Title>
            {project && <ProjectAvatar project={project} size={36} />}
            {domain || NULL_DOMAIN_DESCRIPTION}
            <DomainStatusLink domain={domain} />
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
          {domain === '' && (
            <Alert type="info">
              {tct(
                '"Unknown Domain" entries can be caused by instrumentation errors. Please refer to our [link] for more information.',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/performance/requests/">
                      documentation
                    </ExternalLink>
                  ),
                }
              )}
            </Alert>
          )}

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
                      'http'
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
                series={[durationData[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
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

      <HTTPSamplesPanel />
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
      title={[t('Performance'), MODULE_TITLE, t('Domain Summary')].join(' — ')}
      features="spans-first-ui"
    >
      <HTTPDomainSummaryPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
