import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {STARRED_SEGMENT_TABLE_QUERY_KEY} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import OverviewApiLatencyChartWidget from 'sentry/views/insights/common/components/widgets/overviewApiLatencyChartWidget';
import OverviewCacheMissChartWidget from 'sentry/views/insights/common/components/widgets/overviewCacheMissChartWidget';
import OverviewJobsChartWidget from 'sentry/views/insights/common/components/widgets/overviewJobsChartWidget';
import OverviewRequestsChartWidget from 'sentry/views/insights/common/components/widgets/overviewRequestsChartWidget';
import OverviewSlowQueriesChartWidget from 'sentry/views/insights/common/components/widgets/overviewSlowQueriesChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
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
import {OVERVIEW_PAGE_ALLOWED_OPS as FRONTEND_OVERVIEW_PAGE_OPS} from 'sentry/views/insights/pages/frontend/settings';
import {OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_OPS} from 'sentry/views/insights/pages/mobile/settings';
import {LaravelOverviewPage} from 'sentry/views/insights/pages/platform/laravel';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {NextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {TransactionNameSearchBar} from 'sentry/views/insights/pages/transactionNameSearchBar';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';
import {categorizeProjects} from 'sentry/views/insights/pages/utils';
import type {EAPSpanProperty} from 'sentry/views/insights/types';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';

function BackendOverviewPage() {
  useOverviewPageTrackPageload();
  const isLaravelPageAvailable = useIsLaravelInsightsAvailable();
  const isNextJsPageEnabled = useIsNextJsInsightsAvailable();
  const isNewBackendExperienceEnabled = useInsightsEap();
  if (isLaravelPageAvailable) {
    return <LaravelOverviewPage />;
  }
  if (isNextJsPageEnabled) {
    return <NextJsOverviewPage performanceType="backend" />;
  }
  if (isNewBackendExperienceEnabled) {
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
  const cursor = decodeScalar(location.query?.[QueryParameterNames.PAGES_CURSOR]);

  const {query: searchBarQuery} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  const disallowedOps = [
    ...new Set([...FRONTEND_OVERVIEW_PAGE_OPS, ...BACKEND_OVERVIEW_PAGE_OPS]),
  ];

  const {
    otherProjects: selectedOtherProjects,
    frontendProjects: selectedFrontendProjects,
    mobileProjects: selectedMobileProjects,
    backendProjects: selectedBackendProjects,
  } = categorizeProjects(getSelectedProjectList(selection.projects, projects));

  const existingQuery = new MutableSearch(searchBarQuery);
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

  const sorts: [ValidSort, ValidSort] = [
    {
      field: 'is_starred_transaction' satisfies EAPSpanProperty,
      kind: 'desc',
    },
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];

  existingQuery.addFilterValue('is_transaction', 'true');

  const response = useSpans(
    {
      search: existingQuery,
      sorts,
      cursor,
      useQueryOptions: {additonalQueryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
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
        'sum(span.duration)',
      ],
    },
    'api.performance.landing-table'
  );

  const searchBarProjectsIds = [...selectedBackendProjects, ...selectedOtherProjects].map(
    project => project.id
  );

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <BackendHeader headerTitle={BACKEND_LANDING_TITLE} />
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <InsightsProjectSelector />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {!showOnboarding && (
                  <StyledTransactionNameSearchBar
                    organization={organization}
                    projectIds={searchBarProjectsIds}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                    query={getFreeTextFromQuery(searchBarQuery) ?? ''}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <PageAlert />
            {showOnboarding ? (
              <LegacyOnboarding project={onboardingProject} organization={organization} />
            ) : (
              <Fragment>
                <ModuleLayout.Third>
                  <StackedWidgetWrapper>
                    <OverviewRequestsChartWidget />
                    <OverviewApiLatencyChartWidget />
                  </StackedWidgetWrapper>
                </ModuleLayout.Third>
                <ModuleLayout.TwoThirds>
                  <IssuesWidget />
                </ModuleLayout.TwoThirds>
                <ModuleLayout.Full>
                  <TripleRowWidgetWrapper>
                    <ModuleLayout.Third>
                      <OverviewJobsChartWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewSlowQueriesChartWidget />
                    </ModuleLayout.Third>
                    <ModuleLayout.Third>
                      <OverviewCacheMissChartWidget />
                    </ModuleLayout.Third>
                  </TripleRowWidgetWrapper>
                </ModuleLayout.Full>
                <ModuleLayout.Full>
                  <BackendOverviewTable response={response} sort={sorts[1]} />
                </ModuleLayout.Full>
              </Fragment>
            )}
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

const StackedWidgetWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  height: 100%;
  min-height: 502px;
`;

const TripleRowWidgetWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: 300px;
  gap: ${space(2)};
`;
