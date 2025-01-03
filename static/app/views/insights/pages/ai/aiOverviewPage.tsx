import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert, usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {ViewTrendsButton} from 'sentry/views/insights/common/components/viewTrendsButton';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {
  AI_LANDING_TITLE,
  AI_RELEASE_LEVEL,
} from 'sentry/views/insights/pages/ai/settings';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {generateGenericPerformanceEventView} from 'sentry/views/performance/data';
import {TripleChartRow} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Onboarding from 'sentry/views/performance/onboarding';
import Table from 'sentry/views/performance/table';
import {
  getTransactionSearchQuery,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

export const AI_COLUMN_TITLES = [
  {title: 'transaction'},
  {title: 'operation'},
  {title: 'project'},
  {title: 'tpm'},
  {title: 'p50()'},
  {title: 'p95()'},
  {title: 'users'},
];

function AiOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {setPageError} = usePageAlert();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();
  const {teams} = useUserTeams();
  const mepSetting = useMEPSettingContext();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateGenericPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );

  // TODO - this should come from MetricsField / EAP fields
  eventView.fields = [
    {field: 'team_key_transaction'},
    {field: 'transaction'},
    {field: 'transaction.op'},
    {field: 'project'},
    {field: 'tpm()'},
    {field: 'p50()'},
    {field: 'p95()'},
  ].map(field => ({...field, width: COL_WIDTH_UNDEFINED}));

  const showOnboarding = onboardingProject !== undefined;

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
    trackAnalytics('performance.domains.ai.search', {organization});

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
      <AiHeader
        headerTitle={
          <Fragment>
            {AI_LANDING_TITLE}
            <FeatureBadge type={AI_RELEASE_LEVEL} />
          </Fragment>
        }
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
                    eventView={eventView}
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
                  value={{performanceType: ProjectPerformanceType.ANY}}
                >
                  <TeamKeyTransactionManager.Provider
                    organization={organization}
                    teams={teams}
                    selectedTeams={['myteams']}
                    selectedProjects={eventView.project.map(String)}
                  >
                    <TripleChartRow
                      allowedCharts={tripleChartRowCharts}
                      {...sharedProps}
                    />
                    <Table
                      projects={projects}
                      columnTitles={AI_COLUMN_TITLES}
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

function AiOverviewPageWithProviders() {
  return (
    <DomainOverviewPageProviders>
      <AiOverviewPage />
    </DomainOverviewPageProviders>
  );
}
const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default AiOverviewPageWithProviders;
