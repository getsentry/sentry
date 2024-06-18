import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {NoDataMessage} from 'sentry/views/performance/database/noDataMessage';
import {isAValidSort, QueriesTable} from 'sentry/views/performance/database/queriesTable';
import {
  BASE_FILTERS,
  DEFAULT_DURATION_AGGREGATE,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/performance/database/settings';
import {ThroughputChart} from 'sentry/views/performance/database/throughputChart';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {useHasDataTrackAnalytics} from 'sentry/views/performance/utils/analytics/useHasDataTrackAnalytics';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

export function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();

  const selectedAggregate = DEFAULT_DURATION_AGGREGATE;
  const spanDescription = decodeScalar(location.query?.['span.description'], '');
  const spanAction = decodeScalar(location.query?.['span.action']);
  const spanDomain = decodeScalar(location.query?.['span.domain']);

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  let sort = decodeSorts(sortField).filter(isAValidSort)[0];
  if (!sort) {
    sort = DEFAULT_SORT;
  }

  const handleSearch = (newQuery: string) => {
    trackAnalytics('insight.general.search', {
      organization,
      query: newQuery,
      source: ModuleName.DB,
    });
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        'span.description': newQuery === '' ? undefined : newQuery,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  const chartFilters = BASE_FILTERS;

  const tableFilters = {
    ...BASE_FILTERS,
    'span.action': spanAction,
    'span.domain': spanDomain,
    'span.description': spanDescription ? `*${spanDescription}*` : undefined,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const queryListResponse = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(tableFilters),
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
    },
    'api.starfish.use-span-list'
  );

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['spm()'],
    },
    'api.starfish.span-landing-page-metrics-chart'
  );

  const {
    isLoading: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    },
    'api.starfish.span-landing-page-metrics-chart'
  );

  useHasDataTrackAnalytics(
    MutableSearch.fromQueryObject(BASE_FILTERS),
    'api.performance.database.database-landing',
    'insight.page_loads.db'
  );

  const isCriticalDataLoading =
    isThroughputDataLoading || isDurationDataLoading || queryListResponse.isLoading;

  const isAnyCriticalDataAvailable =
    (queryListResponse.data ?? []).length > 0 ||
    durationData[`${selectedAggregate}(span.self_time)`].data?.some(
      ({value}) => value > 0
    ) ||
    throughputData['spm()'].data?.some(({value}) => value > 0);

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  const crumbs = useModuleBreadcrumbs('db');

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
            {!onboardingProject && !isCriticalDataLoading && (
              <ModuleLayout.Full>
                <NoDataMessage
                  Wrapper={AlertBanner}
                  isDataAvailable={isAnyCriticalDataAvailable}
                />
              </ModuleLayout.Full>
            )}

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
                    series={[durationData[`${selectedAggregate}(span.self_time)`]]}
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

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="db" features="insights-initial-modules">
      <DatabaseLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
