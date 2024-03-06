import React, {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import pickBy from 'lodash/pickBy';

import Alert from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {NoDataMessage} from 'sentry/views/performance/database/noDataMessage';
import {isAValidSort, QueriesTable} from 'sentry/views/performance/database/queriesTable';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useSelectedDurationAggregate} from 'sentry/views/performance/database/useSelectedDurationAggregate';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

export function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();

  const [selectedAggregate] = useSelectedDurationAggregate();
  const spanDescription = decodeScalar(location.query?.['span.description'], '');
  const spanAction = decodeScalar(location.query?.['span.action']);
  const spanDomain = decodeScalar(location.query?.['span.domain']);

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  let sort = fromSorts(sortField).filter(isAValidSort)[0];
  if (!sort) {
    sort = DEFAULT_SORT;
  }

  const handleSearch = (newQuery: string) => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        'span.description': newQuery === '' ? undefined : newQuery,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  const chartFilters = {
    'span.module': ModuleName.DB,
    has: 'span.description',
  };

  const tableFilters = {
    'span.module': ModuleName.DB,
    'span.action': spanAction,
    'span.domain': spanDomain,
    'span.description': spanDescription ? `*${spanDescription}*` : undefined,
    has: 'span.description',
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const queryListResponse = useSpanMetrics({
    filters: pickBy(tableFilters, value => value !== undefined),
    fields: [
      'project.id',
      'span.group',
      'span.description',
      'spm()',
      'avg(span.self_time)',
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [sort],
    limit: LIMIT,
    cursor,
    referrer: 'api.starfish.use-span-list',
  });

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    filters: chartFilters,
    yAxis: ['spm()'],
    enabled: Object.values(chartFilters).every(value => Boolean(value)),
    referrer: 'api.starfish.span-landing-page-metrics-chart',
  });

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    filters: chartFilters,
    yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    enabled: Object.values(chartFilters).every(value => Boolean(value)),
    referrer: 'api.starfish.span-landing-page-metrics-chart',
  });

  const isCriticalDataLoading =
    isThroughputDataLoading || isDurationDataLoading || queryListResponse.isLoading;

  const isAnyCriticalDataAvailable =
    (queryListResponse.data ?? []).length > 0 ||
    durationData[`${selectedAggregate}(span.self_time)`].data?.some(
      ({value}) => value > 0
    ) ||
    throughputData['spm()'].data?.some(({value}) => value > 0);

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
                label: 'Queries',
              },
            ]}
          />

          <Layout.Title>{t('Queries')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            {!onboardingProject && !isCriticalDataLoading && (
              <ModuleLayout.Full>
                <NoDataMessage
                  Wrapper={AlertBanner}
                  isDataAvailable={isAnyCriticalDataAvailable}
                />
              </ModuleLayout.Full>
            )}

            <FloatingFeedbackWidget />

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
                <ModuleLayout.Half>
                  <ThroughputChart
                    series={throughputData['spm()']}
                    isLoading={isThroughputDataLoading}
                    error={throughputError}
                  />
                </ModuleLayout.Half>

                <ModuleLayout.Half>
                  <DurationChart
                    series={durationData[`${selectedAggregate}(span.self_time)`]}
                    isLoading={isDurationDataLoading}
                    error={durationError}
                  />
                </ModuleLayout.Half>

                <ModuleLayout.Full>
                  <FilterOptionsContainer>
                    <SelectorContainer>
                      <ActionSelector moduleName={moduleName} value={spanAction ?? ''} />
                    </SelectorContainer>

                    <SelectorContainer>
                      <DomainSelector moduleName={moduleName} value={spanDomain ?? ''} />
                    </SelectorContainer>
                  </FilterOptionsContainer>
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <SearchBar
                    query={spanDescription}
                    placeholder={t('Search for more Queries')}
                    onSearch={handleSearch}
                  />
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <QueriesTable response={queryListResponse} sort={sort} />
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

function AlertBanner(props) {
  return <Alert {...props} type="info" showIcon />;
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-wrap: nowrap;
  }
`;

const SelectorContainer = styled('div')`
  flex-basis: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-basis: auto;
  }
`;

const LIMIT: number = 25;

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), t('Database')].join(' — ')}
      baseURL="/performance/database"
      features="performance-database-view"
    >
      <DatabaseLandingPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
