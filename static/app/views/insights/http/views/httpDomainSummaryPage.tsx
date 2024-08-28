import React from 'react';

import Alert from 'sentry/components/alert';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t, tct} from 'sentry/locale';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeList, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {
  EMPTY_OPTION_VALUE,
  escapeFilterValue,
  MutableSearch,
} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {useSynchronizeCharts} from 'sentry/views/insights/common/components/chart';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ReadoutRibbon, ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {DurationChart} from 'sentry/views/insights/http/components/charts/durationChart';
import {ResponseRateChart} from 'sentry/views/insights/http/components/charts/responseRateChart';
import {ThroughputChart} from 'sentry/views/insights/http/components/charts/throughputChart';
import {DomainStatusLink} from 'sentry/views/insights/http/components/domainStatusLink';
import {HTTPSamplesPanel} from 'sentry/views/insights/http/components/httpSamplesPanel';
import {
  DomainTransactionsTable,
  isAValidSort,
} from 'sentry/views/insights/http/components/tables/domainTransactionsTable';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {
  BASE_FILTERS,
  MODULE_DOC_LINK,
  NULL_DOMAIN_DESCRIPTION,
} from 'sentry/views/insights/http/settings';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';
import {SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

type Query = {
  aggregate?: string;
  domain?: string;
};

export function HTTPDomainSummaryPage() {
  const location = useLocation<Query>();
  const {projects} = useProjects();

  // TODO: Fetch sort information using `useLocationQuery`
  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const {
    domain,
    project: projectId,
    'user.geo.subregion': subregions,
  } = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      [SpanMetricsField.USER_GEO_SUBREGION]: decodeList,
    },
  });

  const project = projects.find(p => projectId === p.id);
  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    'span.domain': domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(domain),
    ...(subregions.length > 0
      ? {
          [SpanMetricsField.USER_GEO_SUBREGION]: `[${subregions.join(',')}]`,
        }
      : {}),
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  const {data: domainMetrics, isPending: areDomainMetricsLoading} = useSpanMetrics(
    {
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
    },
    Referrer.DOMAIN_SUMMARY_METRICS_RIBBON
  );

  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['spm()'],
    },
    Referrer.DOMAIN_SUMMARY_THROUGHPUT_CHART
  );

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
    },
    Referrer.DOMAIN_SUMMARY_DURATION_CHART
  );

  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
    },
    Referrer.DOMAIN_SUMMARY_RESPONSE_CODE_CHART
  );

  const {
    isPending: isTransactionsListLoading,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpanMetrics(
    {
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
    },
    Referrer.DOMAIN_SUMMARY_TRANSACTIONS_LIST
  );

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  const crumbs = useModuleBreadcrumbs('http');

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              ...crumbs,
              {
                label: 'Domain Summary',
              },
            ]}
          />
          <Layout.Title>
            {project && <ProjectAvatar project={project} size={36} />}
            {domain || NULL_DOMAIN_DESCRIPTION}
            <DomainStatusLink domain={domain} />
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
                  link: <ExternalLink href={MODULE_DOC_LINK}>documentation</ExternalLink>,
                }
              )}
            </Alert>
          )}

          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <HeaderContainer>
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>
                  <SubregionSelector />
                </ToolRibbon>

                <ReadoutRibbon>
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
                </ReadoutRibbon>
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

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="http"
      pageTitle={t('Domain Summary')}
      features="insights-initial-modules"
    >
      <HTTPDomainSummaryPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
