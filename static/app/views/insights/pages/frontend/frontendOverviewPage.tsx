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
import {ViewTrendsButton} from 'sentry/views/insights/common/components/viewTrendsButton';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {
  FRONTEND_LANDING_TITLE,
  FRONTEND_PLATFORMS,
  OVERVIEW_PAGE_ALLOWED_OPS,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  generateFrontendOtherPerformanceEventView,
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

const DURATION_TOOLTIP = tct(
  'A heuristic measuring when a pageload or navigation completes. Based on whether the initial load of the webpage has become idle. [link:Learn more.]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/automatic-instrumentation/#idletimeout" />
    ),
  }
);

export const FRONTEND_COLUMN_TITLES = [
  {title: 'transaction'},
  {title: 'operation'},
  {title: 'project'},
  {title: 'tpm'},
  {title: 'p50()', tooltip: DURATION_TOOLTIP},
  {title: 'p75()', tooltip: DURATION_TOOLTIP},
  {title: 'p95()', tooltip: DURATION_TOOLTIP},
  {title: 'users'},
  {title: 'user misery', tooltip: USER_MISERY_TOOLTIP},
];

function FrontendOverviewPage() {
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
  const eventView = generateFrontendOtherPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );
  const searchBarEventView = eventView.clone();

  const sharedProps = {eventView, location, organization, withStaticFilters};

  // TODO - this should come from MetricsField / EAP fields
  eventView.fields = [
    {field: 'team_key_transaction'},
    {field: 'transaction'},
    {field: 'transaction.op'},
    {field: 'project'},
    {field: 'tpm()'},
    {field: 'p50(transaction.duration)'},
    {field: 'p75(transaction.duration)'},
    {field: 'p95(transaction.duration)'},
    {field: 'count_unique(user)'},
    {field: 'count_miserable(user)'},
    {field: 'user_misery()'},
  ].map(field => ({...field, width: COL_WIDTH_UNDEFINED}));

  const doubleChartRowEventView = eventView.clone(); // some of the double chart rows rely on span metrics, so they can't be queried the same way

  const selectedFrontendProjects: Project[] = getSelectedProjectList(
    selection.projects,
    projects
  ).filter((project): project is Project =>
    Boolean(project?.platform && FRONTEND_PLATFORMS.includes(project.platform))
  );

  const existingQuery = new MutableSearch(eventView.query);
  existingQuery.addDisjunctionFilterValues('transaction.op', OVERVIEW_PAGE_ALLOWED_OPS);
  // add disjunction filter creates a very long query as it seperates conditions with OR, project ids are numeric with no spaces, so we can use a comma seperated list
  if (selectedFrontendProjects.length > 0) {
    existingQuery.addOp('OR');
    existingQuery.addFilterValue(
      'project.id',
      `[${selectedFrontendProjects.map(({id}) => id).join(',')}]`
    );
  }
  eventView.query = existingQuery.formatString();

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
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
    ],
    mepSetting
  );

  if (organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES);
  }

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
    trackAnalytics('performance.domains.frontend.search', {organization});

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
      <FrontendHeader
        headerTitle={FRONTEND_LANDING_TITLE}
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
                  value={{performanceType: ProjectPerformanceType.FRONTEND_OTHER}}
                >
                  <DoubleChartRow
                    allowedCharts={doubleChartRowCharts}
                    {...sharedProps}
                    eventView={doubleChartRowEventView}
                  />
                  <TripleChartRow allowedCharts={tripleChartRowCharts} {...sharedProps} />
                  <TeamKeyTransactionManager.Provider
                    organization={organization}
                    teams={teams}
                    selectedTeams={['myteams']}
                    selectedProjects={eventView.project.map(String)}
                  >
                    <Table
                      projects={projects}
                      columnTitles={FRONTEND_COLUMN_TITLES}
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

function FrontendOverviewPageWithProviders() {
  return (
    <DomainOverviewPageProviders>
      <FrontendOverviewPage />
    </DomainOverviewPageProviders>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default FrontendOverviewPageWithProviders;
