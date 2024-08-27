import React from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {useSynchronizeCharts} from 'sentry/views/insights/common/components/chart';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {ActionSelector} from 'sentry/views/insights/common/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import {DurationChart} from 'sentry/views/insights/database/components/charts/durationChart';
import {ThroughputChart} from 'sentry/views/insights/database/components/charts/throughputChart';
import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';
import {NoDataMessage} from 'sentry/views/insights/database/components/noDataMessage';
import {
  isAValidSort,
  QueriesTable,
} from 'sentry/views/insights/database/components/tables/queriesTable';
import {
  BASE_FILTERS,
  DEFAULT_DURATION_AGGREGATE,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/database/settings';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

export function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const hasModuleData = useHasFirstSpan(moduleName);

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
    isPending: isThroughputDataLoading,
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
    isPending: isDurationDataLoading,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: [`${selectedAggregate}(${SpanMetricsField.SPAN_SELF_TIME})`],
    },
    'api.starfish.span-landing-page-metrics-chart'
  );

  const isCriticalDataLoading =
    isThroughputDataLoading || isDurationDataLoading || queryListResponse.isPending;

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
            {hasModuleData && !onboardingProject && !isCriticalDataLoading && (
              <NoDataMessage
                Wrapper={AlertBanner}
                isDataAvailable={isAnyCriticalDataAvailable}
              />
            )}

            <ModuleLayout.Full>
              <PageFilterWrapper>
                <ModulePageFilterBar moduleName={ModuleName.DB} />
                {organization.features.includes(
                  'performance-queries-mongodb-extraction'
                ) && <DatabaseSystemSelector />}
              </PageFilterWrapper>
            </ModuleLayout.Full>
            <ModulesOnboarding moduleName={ModuleName.DB}>
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
                <ToolRibbon>
                  <ActionSelector moduleName={moduleName} value={spanAction ?? ''} />
                  <DomainSelector moduleName={moduleName} value={spanDomain ?? ''} />
                </ToolRibbon>
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

function AlertBanner(props) {
  return (
    <ModuleLayout.Full>
      <Alert {...props} type="info" showIcon />
    </ModuleLayout.Full>
  );
}

const LIMIT: number = 25;

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="db"
      features="insights-initial-modules"
      analyticEventName="insight.page_loads.db"
    >
      <DatabaseLandingPage />
    </ModulePageProviders>
  );
}

const PageFilterWrapper = styled('div')`
  display: flex;
  gap: ${space(3)};
`;

export default PageWithProviders;
