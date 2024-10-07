import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {trackAnalytics} from 'sentry/utils/analytics';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert, usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ViewTrendsButton} from 'sentry/views/insights/common/viewTrendsButton';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Onboarding from 'sentry/views/performance/onboarding';
import Table from 'sentry/views/performance/table';
import {
  getTransactionSearchQuery,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

export const BACKEND_COLUMN_TITLES = [
  'transaction',
  'project',
  'operation',
  'http method',
  'tpm',
  'p50',
  'p95',
  'failure rate',
  'apdex',
  'users',
  'user misery',
];

function BackendOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {setPageError} = usePageAlert();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );

  // TODO - this should come from MetricsField / EAP fields
  eventView.fields = [
    {field: 'team_key_transaction'},
    {field: 'transaction'},
    {field: 'transaction.op'},
    {field: 'http.method'},
    {field: 'project'},
    {field: 'tpm()'},
    {field: 'p50(transaction.duration)'},
    {field: 'p95(transaction.duration)'},
    {field: 'failure_rate()'},
    {field: 'apdex()'},
    {field: 'count_unique(user)'},
    {field: 'count_miserable(user)'},
    {field: 'user_misery()'},
  ].map(field => ({...field, width: COL_WIDTH_UNDEFINED}));

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
  ];
  const tripleChartRowCharts = [
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.DURATION_HISTOGRAM,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
    PerformanceWidgetSetting.FAILURE_RATE_AREA,
    PerformanceWidgetSetting.APDEX_AREA,
  ];

  if (organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts.unshift(
      PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
    );
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES);
  }

  const sharedProps = {eventView, location, organization, withStaticFilters};

  const getFreeTextFromQuery = (query: string) => {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      return transactionValues[0];
    }
    if (conditions.freeText.length > 0) {
      // raw text query will be wrapped in wildcards in generatePerformanceEventView
      // so no need to wrap it here
      return conditions.freeText.join(' ');
    }
    return '';
  };

  function handleSearch(searchQuery: string) {
    trackAnalytics('performance.domains.backend.search', {organization});

    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        isDefaultQuery: false,
      },
    });
  }

  const derivedQuery = getTransactionSearchQuery(location, eventView.query);

  return (
    <Feature
      features="insights-domain-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <BackendHeader headerActions={<ViewTrendsButton />} />
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {!showOnboarding && (
                  <StyledTransactionNameSearchBar
                    organization={organization}
                    eventView={eventView}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                    query={getFreeTextFromQuery(derivedQuery)}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <PageAlert />
            <ModuleLayout.Full>
              {!showOnboarding && (
                <PerformanceDisplayProvider
                  value={{performanceType: ProjectPerformanceType.BACKEND}}
                >
                  <DoubleChartRow allowedCharts={doubleChartRowCharts} {...sharedProps} />
                  <TripleChartRow allowedCharts={tripleChartRowCharts} {...sharedProps} />
                  <Table
                    projects={projects}
                    columnTitles={BACKEND_COLUMN_TITLES}
                    setError={setPageError}
                    {...sharedProps}
                  />
                </PerformanceDisplayProvider>
              )}

              {showOnboarding && (
                <Onboarding project={onboardingProject} organization={organization} />
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

function BackendOverviewPageWithProviders() {
  const organization = useOrganization();

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={OVERVIEW_PAGE_TITLE} orgSlug={organization.slug}>
        <BackendOverviewPage />
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default BackendOverviewPageWithProviders;
