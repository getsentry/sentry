import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {space} from 'sentry/styles/space';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ViewTrendsButton} from 'sentry/views/insights/common/viewTrendsButton';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {CachesWidget} from 'sentry/views/insights/pages/backend/laravel/cachesWidget';
import {DurationWidget} from 'sentry/views/insights/pages/backend/laravel/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/backend/laravel/issuesWidget';
import {JobsWidget} from 'sentry/views/insights/pages/backend/laravel/jobsWidget';
import {PathsTable} from 'sentry/views/insights/pages/backend/laravel/pathsTable';
import {QueriesWidget} from 'sentry/views/insights/pages/backend/laravel/queriesWidget';
import {RequestsWidget} from 'sentry/views/insights/pages/backend/laravel/requestsWidget';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {
  getTransactionSearchQuery,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

function getFreeTextFromQuery(query: string) {
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
}

export function LaravelOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(location, withStaticFilters);

  const showOnboarding = onboardingProject !== undefined;

  function handleSearch(searchQuery: string) {
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
                    eventView={eventView}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                    query={getFreeTextFromQuery(derivedQuery)!}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <ModuleLayout.Full>
              {!showOnboarding && (
                <PerformanceDisplayProvider
                  value={{performanceType: ProjectPerformanceType.BACKEND}}
                >
                  <WidgetGrid>
                    <RequestsContainer>
                      <RequestsWidget query={derivedQuery} />
                    </RequestsContainer>
                    <IssuesContainer>
                      <IssuesWidget query={derivedQuery} />
                    </IssuesContainer>
                    <DurationContainer>
                      <DurationWidget query={derivedQuery} />
                    </DurationContainer>
                    <JobsContainer>
                      <JobsWidget query={derivedQuery} />
                    </JobsContainer>
                    <QueriesContainer>
                      <QueriesWidget query={derivedQuery} />
                    </QueriesContainer>
                    <CachesContainer>
                      <CachesWidget query={derivedQuery} />
                    </CachesContainer>
                  </WidgetGrid>
                  <PathsTable query={derivedQuery} />
                </PerformanceDisplayProvider>
              )}
              {showOnboarding && (
                <LegacyOnboarding
                  project={onboardingProject}
                  organization={organization}
                />
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

const WidgetGrid = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding-bottom: ${space(2)};

  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 180px 180px 300px 180px 300px 300px;
  grid-template-areas:
    'requests'
    'duration'
    'issues'
    'jobs'
    'queries'
    'caches';

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 300px 180px 300px;
    grid-template-areas:
      'requests duration'
      'issues issues'
      'jobs jobs'
      'queries caches';
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 180px 180px 300px;
    grid-template-areas:
      'requests issues issues'
      'duration issues issues'
      'jobs queries caches';
  }
`;

const RequestsContainer = styled('div')`
  grid-area: requests;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

// TODO(aknaus): Remove css hacks and build custom IssuesWidget
const IssuesContainer = styled('div')`
  grid-area: issues;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  & > * {
    min-width: 0;
    overflow-y: auto;
    margin-bottom: 0 !important;
  }

  & ${PanelHeader} {
    position: sticky;
    top: 0;
    z-index: ${p => p.theme.zIndex.header};
  }
`;

const DurationContainer = styled('div')`
  grid-area: duration;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

const JobsContainer = styled('div')`
  grid-area: jobs;
  min-width: 0;
  & > * {
    height: 100% !important;
  }
`;

const QueriesContainer = styled('div')`
  grid-area: queries;
`;

const CachesContainer = styled('div')`
  grid-area: caches;
`;

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;
