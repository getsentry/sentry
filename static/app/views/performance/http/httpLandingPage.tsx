import React, {Fragment} from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {DurationChart} from 'sentry/views/performance/http/charts/durationChart';
import {ResponseRateChart} from 'sentry/views/performance/http/charts/responseRateChart';
import {ThroughputChart} from 'sentry/views/performance/http/charts/throughputChart';
import {Referrer} from 'sentry/views/performance/http/referrers';
import {MODULE_TITLE, RELEASE_LEVEL} from 'sentry/views/performance/http/settings';
import {
  DomainsTable,
  isAValidSort,
} from 'sentry/views/performance/http/tables/domainsTable';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {ModuleName} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

export function HTTPLandingPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_SORT]);

  // TODO: Pull this using `useLocationQuery` below
  const sort = decodeSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const query = useLocationQuery({
    fields: {
      'span.domain': decodeScalar,
    },
  });

  const chartFilters = {
    'span.module': ModuleName.HTTP,
  };

  const tableFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': query['span.domain'] ? `*${query['span.domain']}*` : undefined,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_CURSOR]);

  const handleSearch = (newDomain: string) => {
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
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(chartFilters),
    yAxis: ['spm()'],
    referrer: Referrer.LANDING_THROUGHPUT_CHART,
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(chartFilters),
    yAxis: [`avg(span.self_time)`],
    referrer: Referrer.LANDING_DURATION_CHART,
  });

  const {
    isLoading: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(chartFilters),
    yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
    referrer: Referrer.LANDING_RESPONSE_CODE_CHART,
  });

  const domainsListResponse = useSpanMetrics({
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
    referrer: Referrer.LANDING_DOMAINS_LIST,
  });

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

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

            {onboardingProject && (
              <ModuleLayout.Full>
                <Onboarding organization={organization} project={onboardingProject} />
              </ModuleLayout.Full>
            )}

            {!onboardingProject && (
              <Fragment>
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
              </Fragment>
            )}
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

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL="/performance/http"
      features="spans-first-ui"
    >
      <HTTPLandingPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
