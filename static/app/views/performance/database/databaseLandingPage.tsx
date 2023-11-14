import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {NoDataMessage} from 'sentry/views/performance/database/noDataMessage';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';
import Onboarding from 'sentry/views/performance/onboarding';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import SpansTable from 'sentry/views/starfish/views/spans/spansTable';
import {useModuleFilters} from 'sentry/views/starfish/views/spans/useModuleFilters';
import {useModuleSort} from 'sentry/views/starfish/views/spans/useModuleSort';

function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();

  const {selectedAggregate} = useAvailableDurationAggregates();
  const spanDescription = decodeScalar(location.query?.['span.description'], '');
  const moduleFilters = useModuleFilters();
  const sort = useModuleSort(QueryParameterNames.SPANS_SORT);

  const handleSearch = (newQuery: string) => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        'span.description': newQuery === '' ? undefined : newQuery,
        cursor: undefined,
      },
    });
  };

  const filters = {
    'span.module': ModuleName.DB,
  };

  const {isLoading: isThroughputDataLoading, data: throughputData} = useSpanMetricsSeries(
    filters,
    ['spm()'],
    'api.starfish.span-summary-page-metrics-chart'
  );

  const {isLoading: isDurationDataLoading, data: durationData} = useSpanMetricsSeries(
    filters,
    [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    'api.starfish.span-summary-page-metrics-chart'
  );

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  return (
    <ModulePageProviders title={[t('Performance'), t('Database')].join(' — ')}>
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
          {!onboardingProject && <NoDataMessage Wrapper={AlertBanner} />}
          <FeedbackWidget />
          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </PaddedContainer>

          {onboardingProject && (
            <Onboarding organization={organization} project={onboardingProject} />
          )}
          {!onboardingProject && (
            <Fragment>
              <ChartContainer>
                <ThroughputChart
                  series={throughputData['spm()']}
                  isLoading={isThroughputDataLoading}
                />
                <DurationChart
                  series={
                    durationData[
                      `${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`
                    ]
                  }
                  isLoading={isDurationDataLoading}
                />
              </ChartContainer>
              <FilterOptionsContainer>
                <ActionSelector
                  moduleName={moduleName}
                  value={moduleFilters[SpanMetricsField.SPAN_ACTION] || ''}
                />

                <DomainSelector
                  moduleName={moduleName}
                  value={moduleFilters[SpanMetricsField.SPAN_DOMAIN] || ''}
                />
              </FilterOptionsContainer>
              <SearchBarContainer>
                <SearchBar
                  query={spanDescription}
                  placeholder={t('Search for more Queries')}
                  onSearch={handleSearch}
                />
              </SearchBarContainer>
              <SpansTable moduleName={moduleName} sort={sort} limit={LIMIT} />
            </Fragment>
          )}
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const ChartContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr 1fr;
`;

function AlertBanner(props) {
  return <Alert {...props} type="info" showIcon />;
}

const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

const SearchBarContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const LIMIT: number = 25;

export default DatabaseLandingPage;
