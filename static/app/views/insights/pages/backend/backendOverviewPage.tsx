import {useMemo} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert, usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ViewTrendsButton} from 'sentry/views/insights/common/viewTrendsButton';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {LaravelOverviewPage} from 'sentry/views/insights/pages/backend/laravelOverviewPage';
import {
  BACKEND_LANDING_TITLE,
  OVERVIEW_PAGE_ALLOWED_OPS,
} from 'sentry/views/insights/pages/backend/settings';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {
  FRONTEND_PLATFORMS,
  OVERVIEW_PAGE_ALLOWED_OPS as FRONTEND_OVERVIEW_PAGE_OPS,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_PLATFORMS,
  OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_OPS,
} from 'sentry/views/insights/pages/mobile/settings';
import {
  generateBackendPerformanceEventView,
  USER_MISERY_TOOLTIP,
} from 'sentry/views/performance/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Onboarding from 'sentry/views/performance/onboarding';
import Table from 'sentry/views/performance/table';
import {
  getTransactionSearchQuery,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

const APDEX_TOOLTIP = tct(
  'An industry-standard metric used to measure user satisfaction based on your application response times. [link:Learn more.]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#apdex" />
    ),
  }
);

export const BACKEND_COLUMN_TITLES = [
  {title: 'http method'},
  {title: 'transaction'},
  {title: 'operation'},
  {title: 'project'},
  {title: 'tpm'},
  {title: 'p50()'},
  {title: 'p95()'},
  {title: 'failure rate'},
  {title: 'apdex', tooltip: APDEX_TOOLTIP},
  {title: 'users'},
  {title: 'user misery', tooltip: USER_MISERY_TOOLTIP},
];

function BackendOverviewPage() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects: Project[] = useMemo(
    () => getSelectedProjectList(selection.projects, projects),
    [projects, selection.projects]
  );

  const selectedProject = selectedProjects.length === 1 ? selectedProjects[0] : null;
  if (
    selectedProject?.platform === 'php-laravel' &&
    organization.features.includes('laravel-insights')
  ) {
    return <LaravelOverviewPage />;
  }

  return <GenericBackendOverviewPage />;
}

function GenericBackendOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {setPageError} = usePageAlert();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();
  const {teams} = useUserTeams();
  const mepSetting = useMEPSettingContext();
  const {selection} = usePageFilters();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );
  const searchBarEventView = eventView.clone();

  // TODO - this should come from MetricsField / EAP fields
  eventView.fields = [
    {field: 'team_key_transaction'},
    {field: 'http.method'},
    {field: 'transaction'},
    {field: 'transaction.op'},
    {field: 'project'},
    {field: 'tpm()'},
    {field: 'p50()'},
    {field: 'p95()'},
    {field: 'failure_rate()'},
    {field: 'apdex()'},
    {field: 'count_unique(user)'},
    {field: 'count_miserable(user)'},
    {field: 'user_misery()'},
  ].map(field => ({...field, width: COL_WIDTH_UNDEFINED}));

  const doubleChartRowEventView = eventView.clone(); // some of the double chart rows rely on span metrics, so they can't be queried with the same tags/filters
  const disallowedOps = [
    ...new Set([...FRONTEND_OVERVIEW_PAGE_OPS, ...BACKEND_OVERVIEW_PAGE_OPS]),
  ];

  const selectedFrontendProjects: Project[] = getSelectedProjectList(
    selection.projects,
    projects
  ).filter((project): project is Project =>
    Boolean(project?.platform && FRONTEND_PLATFORMS.includes(project.platform))
  );

  const selectedMobileProjects: Project[] = getSelectedProjectList(
    selection.projects,
    projects
  ).filter((project): project is Project =>
    Boolean(project?.platform && MOBILE_PLATFORMS.includes(project.platform))
  );

  const existingQuery = new MutableSearch(eventView.query);
  existingQuery.addOp('(');
  existingQuery.addOp('(');
  existingQuery.addFilterValues('!transaction.op', disallowedOps);

  if (selectedFrontendProjects.length > 0 || selectedMobileProjects.length > 0) {
    existingQuery.addFilterValue(
      '!project.id',
      `[${[
        ...selectedFrontendProjects.map(project => project.id),
        ...selectedMobileProjects.map(project => project.id),
      ]}]`
    );
  }
  existingQuery.addOp(')');
  existingQuery.addOp('OR');
  existingQuery.addDisjunctionFilterValues('transaction.op', OVERVIEW_PAGE_ALLOWED_OPS);
  existingQuery.addOp(')');

  eventView.query = existingQuery.formatString();

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
  ];
  const tripleChartRowCharts = filterAllowedChartsMetrics(
    organization,
    [
      PerformanceWidgetSetting.TPM_AREA,
      PerformanceWidgetSetting.DURATION_HISTOGRAM,
      PerformanceWidgetSetting.P50_DURATION_AREA,
      PerformanceWidgetSetting.P75_DURATION_AREA,
      PerformanceWidgetSetting.P95_DURATION_AREA,
      PerformanceWidgetSetting.P99_DURATION_AREA,
      PerformanceWidgetSetting.FAILURE_RATE_AREA,
      PerformanceWidgetSetting.APDEX_AREA,
    ],
    mepSetting
  );

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
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <BackendHeader
        headerTitle={BACKEND_LANDING_TITLE}
        headerActions={<ViewTrendsButton />}
      />
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
                    eventView={searchBarEventView}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                    query={getFreeTextFromQuery(derivedQuery)!}
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
                  <TeamKeyTransactionManager.Provider
                    organization={organization}
                    teams={teams}
                    selectedTeams={['myteams']}
                    selectedProjects={eventView.project.map(String)}
                  >
                    <DoubleChartRow
                      allowedCharts={doubleChartRowCharts}
                      {...sharedProps}
                      eventView={doubleChartRowEventView}
                    />
                    <TripleChartRow
                      allowedCharts={tripleChartRowCharts}
                      {...sharedProps}
                    />
                    <Table
                      projects={projects}
                      columnTitles={BACKEND_COLUMN_TITLES}
                      setError={setPageError}
                      {...sharedProps}
                    />
                  </TeamKeyTransactionManager.Provider>
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
  return (
    <DomainOverviewPageProviders>
      <BackendOverviewPage />
    </DomainOverviewPageProviders>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default BackendOverviewPageWithProviders;
