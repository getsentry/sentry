import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {
  BackendOverviewTable,
  isAValidSort,
  type ValidSort,
} from 'sentry/views/insights/pages/backend/backendTable';
import {OldBackendOverviewPage} from 'sentry/views/insights/pages/backend/oldBackendOverviewPage';
import {
  BACKEND_LANDING_TITLE,
  DEFAULT_SORT,
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
import {LaravelOverviewPage} from 'sentry/views/insights/pages/platform/laravel';
import {CachesWidget} from 'sentry/views/insights/pages/platform/laravel/cachesWidget';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {JobsWidget} from 'sentry/views/insights/pages/platform/laravel/jobsWidget';
import {QueriesWidget} from 'sentry/views/insights/pages/platform/laravel/queriesWidget';
import {NextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs';
import {useIsNextJsInsightsEnabled} from 'sentry/views/insights/pages/platform/nextjs/features';
import {NewNextJsExperienceButton} from 'sentry/views/insights/pages/platform/nextjs/newNextjsExperienceToggle';
import {DurationWidget} from 'sentry/views/insights/pages/platform/shared/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {TrafficWidget} from 'sentry/views/insights/pages/platform/shared/trafficWidget';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';
import type {EAPSpanProperty} from 'sentry/views/insights/types';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

function BackendOverviewPage() {
  useOverviewPageTrackPageload();
  const isLaravelPageAvailable = useIsLaravelInsightsAvailable();
  const [isNextJsPageEnabled] = useIsNextJsInsightsEnabled();
  const useEap = useInsightsEap();
  if (isLaravelPageAvailable) {
    return <LaravelOverviewPage />;
  }
  if (isNextJsPageEnabled) {
    return <NextJsOverviewPage performanceType="backend" />;
  }
  if (useEap) {
    return <EAPBackendOverviewPage />;
  }
  return <OldBackendOverviewPage />;
}

function EAPBackendOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(
    location,
    withStaticFilters,
    true
  );
  const searchBarEventView = eventView.clone();

  // TODO - this should come from MetricsField / EAP fields
  eventView.fields = [
    {field: 'team_key_transaction'},
    {field: 'http.method'},
    {field: 'transaction'},
    {field: 'span.op'},
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
  existingQuery.addFilterValues('!span.op', disallowedOps);

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
  existingQuery.addDisjunctionFilterValues('span.op', OVERVIEW_PAGE_ALLOWED_OPS);
  existingQuery.addOp(')');

  eventView.query = existingQuery.formatString();

  const showOnboarding = onboardingProject !== undefined;

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

  const searchBarQuery = getTransactionSearchQuery(location);

  const sorts: [ValidSort, ValidSort] = [
    {
      field: 'is_starred_transaction' satisfies EAPSpanProperty,
      kind: 'desc',
    },
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];

  existingQuery.addFilterValue('is_transaction', 'true');

  const response = useEAPSpans(
    {
      search: existingQuery,
      sorts,
      fields: [
        'is_starred_transaction',
        'request.method',
        'transaction',
        'span.op',
        'project',
        'epm()',
        'p50(span.duration)',
        'p95(span.duration)',
        'failure_rate()',
        'count_unique(user)',
        'time_spent_percentage(span.duration)',
        'sum(span.duration)',
      ],
    },
    'api.performance.landing-table'
  );

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <BackendHeader
        headerTitle={BACKEND_LANDING_TITLE}
        headerActions={<NewNextJsExperienceButton />}
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
                    query={getFreeTextFromQuery(searchBarQuery) ?? ''}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <PageAlert />
            {!showOnboarding && (
              <Fragment>
                <ModuleLayout.Third>
                  <StackedWidgetWrapper>
                    <TrafficWidget
                      title={t('Requests')}
                      trafficSeriesName={t('Requests')}
                      baseQuery={'span.op:http.server'}
                      query={searchBarQuery}
                    />
                    <DurationWidget query={searchBarQuery} />
                  </StackedWidgetWrapper>
                </ModuleLayout.Third>
                <ModuleLayout.TwoThirds>
                  <IssuesWidget query={searchBarQuery} />
                </ModuleLayout.TwoThirds>
                <ModuleLayout.Full>
                  <TripleRowWidgetWrapper>
                    <ModuleLayout.Third>
                      <JobsWidget query={searchBarQuery} />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <QueriesWidget query={searchBarQuery} />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <CachesWidget query={searchBarQuery} />
                    </ModuleLayout.Third>
                  </TripleRowWidgetWrapper>
                </ModuleLayout.Full>
                <ModuleLayout.Full>
                  <BackendOverviewTable response={response} sort={sorts[0]} />
                </ModuleLayout.Full>
              </Fragment>
            )}
            {showOnboarding && (
              <LegacyOnboarding project={onboardingProject} organization={organization} />
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

function BackendOverviewPageWithProviders() {
  const organization = useOrganization();
  const isLaravelPageAvailable = useIsLaravelInsightsAvailable();
  const [isNextJsPageEnabled] = useIsNextJsInsightsEnabled();

  const {maxPickableDays} = limitMaxPickableDays(organization);

  return (
    <DomainOverviewPageProviders
      maxPickableDays={
        isLaravelPageAvailable || isNextJsPageEnabled ? maxPickableDays : undefined
      }
    >
      <BackendOverviewPage />
    </DomainOverviewPageProviders>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default BackendOverviewPageWithProviders;

const StackedWidgetWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  height: 100%;
`;

const TripleRowWidgetWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: ${space(2)};
  height: 300px;
`;
