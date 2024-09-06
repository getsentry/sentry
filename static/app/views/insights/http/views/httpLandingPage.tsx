import React from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeList, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSynchronizeCharts} from 'sentry/views/insights/common/components/chart';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {DurationChart} from 'sentry/views/insights/http/components/charts/durationChart';
import {ResponseRateChart} from 'sentry/views/insights/http/components/charts/responseRateChart';
import {ThroughputChart} from 'sentry/views/insights/http/components/charts/throughputChart';
import {
  DomainsTable,
  isAValidSort,
} from 'sentry/views/insights/http/components/tables/domainsTable';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {
  BASE_FILTERS,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/http/settings';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

export function HTTPLandingPage() {
  const organization = useOrganization();
  const location = useLocation();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_SORT]);

  // TODO: Pull this using `useLocationQuery` below
  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const query = useLocationQuery({
    fields: {
      'span.domain': decodeScalar,
      [SpanMetricsField.USER_GEO_SUBREGION]: decodeList,
    },
  });

  const ADDITIONAL_FILTERS = {};

  if (query[SpanMetricsField.USER_GEO_SUBREGION].length > 0) {
    ADDITIONAL_FILTERS[SpanMetricsField.USER_GEO_SUBREGION] =
      `[${query[SpanMetricsField.USER_GEO_SUBREGION].join(',')}]`;
  }

  const chartFilters = {
    ...BASE_FILTERS,
    ...ADDITIONAL_FILTERS,
  };

  const tableFilters = {
    ...BASE_FILTERS,
    ...ADDITIONAL_FILTERS,
    'span.domain': query['span.domain'] ? `*${query['span.domain']}*` : undefined,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_CURSOR]);

  const handleSearch = (newDomain: string) => {
    trackAnalytics('insight.general.search', {
      organization,
      query: newDomain,
      source: ModuleName.HTTP,
    });
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        'span.domain': newDomain === '' ? undefined : newDomain,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['spm()'],
    },
    Referrer.LANDING_THROUGHPUT_CHART
  );

  const {
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`avg(span.self_time)`],
    },
    Referrer.LANDING_DURATION_CHART
  );

  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
    },
    Referrer.LANDING_RESPONSE_CODE_CHART
  );

  const domainsListResponse = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(tableFilters),
      fields: [
        'project',
        'project.id',
        'span.domain',
        'spm()',
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
        'avg(span.self_time)',
        'sum(span.self_time)',
        'time_spent_percentage()',
      ],
      sorts: [sort],
      limit: DOMAIN_TABLE_ROW_COUNT,
      cursor,
    },
    Referrer.LANDING_DOMAINS_LIST
  );

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  const crumbs = useModuleBreadcrumbs('http');

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
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <ModulePageFilterBar
                  moduleName={ModuleName.HTTP}
                  extraFilters={<SubregionSelector />}
                />
              </ToolRibbon>
            </ModuleLayout.Full>

            <ModulesOnboarding moduleName={ModuleName.HTTP}>
              <ModuleLayout.Third>
                <ThroughputChart
                  series={throughputData['spm()']}
                  isLoading={isThroughputDataLoading}
                  error={throughputError}
                />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <DurationChart
                  series={[durationData[`avg(span.self_time)`]]}
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
                <SearchBar
                  query={query['span.domain']}
                  placeholder={t('Search for more domains')}
                  onSearch={handleSearch}
                />
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                <DomainsTable response={domainsListResponse} sort={sort} />
              </ModuleLayout.Full>
            </ModulesOnboarding>
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

const DOMAIN_TABLE_ROW_COUNT = 10;

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="http"
      features="insights-initial-modules"
      analyticEventName="insight.page_loads.http"
    >
      <HTTPLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
