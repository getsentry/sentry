import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {space} from 'sentry/styles/space';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ViewTrendsButton} from 'sentry/views/insights/common/viewTrendsButton';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

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

function PlaceholderWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title="Placeholder" />}
      Visualization={'No content'}
    />
  );
}

export function LaravelOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );

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
                <Fragment>
                  <WidgetGrid>
                    <RequestsContainer>
                      <PlaceholderWidget />
                    </RequestsContainer>
                    <IssuesContainer>
                      <PlaceholderWidget />
                    </IssuesContainer>
                    <DurationContainer>
                      <PlaceholderWidget />
                    </DurationContainer>
                    <JobsContainer>
                      <PlaceholderWidget />
                    </JobsContainer>
                    <QueriesContainer>
                      <PlaceholderWidget />
                    </QueriesContainer>
                    <CachesContainer>
                      <PlaceholderWidget />
                    </CachesContainer>
                  </WidgetGrid>
                  <PanelTable
                    headers={['Method', 'Route', 'Throughput', 'AVG', 'P95']}
                    isEmpty
                  />
                </Fragment>
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

  grid-template-columns: 1fr;
  grid-template-rows: repeat(6, 180px);
  grid-template-areas:
    'requests'
    'issues'
    'duration'
    'jobs'
    'queries'
    'caches';

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 180px 270px repeat(2, 180px);
    grid-template-areas:
      'requests duration'
      'issues issues'
      'jobs queries'
      'caches caches';
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: repeat(3, 180px);
    grid-template-areas:
      'requests issues issues'
      'duration issues issues'
      'jobs queries caches';
  }
`;

const RequestsContainer = styled('div')`
  grid-area: requests;
`;

const IssuesContainer = styled('div')`
  grid-area: issues;
`;

const DurationContainer = styled('div')`
  grid-area: duration;
`;

const JobsContainer = styled('div')`
  grid-area: jobs;
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
