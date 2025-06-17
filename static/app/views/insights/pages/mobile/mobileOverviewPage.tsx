import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
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
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {
  isAValidSort,
  MobileOverviewTable,
  type ValidSort,
} from 'sentry/views/insights/pages/mobile/mobileOverviewTable';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {OldMobileOverviewPage} from 'sentry/views/insights/pages/mobile/oldMobileOverviewPage';
import {
  DEFAULT_SORT,
  MOBILE_LANDING_TITLE,
  OVERVIEW_PAGE_ALLOWED_OPS,
} from 'sentry/views/insights/pages/mobile/settings';
import {TransactionNameSearchBar} from 'sentry/views/insights/pages/transactionNameSearchBar';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';
import {categorizeProjects} from 'sentry/views/insights/pages/utils';
import type {EAPSpanProperty} from 'sentry/views/insights/types';
import {
  generateGenericPerformanceEventView,
  generateMobilePerformanceEventView,
} from 'sentry/views/performance/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

function EAPMobileOverviewPage() {
  useOverviewPageTrackPageload();

  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();
  const mepSetting = useMEPSettingContext();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.PAGES_CURSOR]);

  const withStaticFilters = canUseMetricsData(organization);

  const eventView = generateMobilePerformanceEventView(
    location,
    projects,
    generateGenericPerformanceEventView(location, withStaticFilters, organization),
    withStaticFilters,
    organization,
    true
  );

  const doubleChartRowEventView = eventView.clone(); // some of the double chart rows rely on span metrics, so they can't be queried the same way

  const {mobileProjects: selectedMobileProjects, otherProjects: selectedOtherProjects} =
    categorizeProjects(getSelectedProjectList(selection.projects, projects));

  const existingQuery = new MutableSearch(eventView.query);
  existingQuery.addOp('(');
  existingQuery.addFilterValue('span.op', `[${OVERVIEW_PAGE_ALLOWED_OPS.join(',')}]`);
  if (selectedMobileProjects.length > 0) {
    existingQuery.addOp('OR');
    existingQuery.addFilterValue(
      'project.id',
      `[${selectedMobileProjects.map(({id}) => id).join(',')}]`
    );
  }
  existingQuery.addOp(')');

  eventView.query = existingQuery.formatString();

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.MOST_SLOW_FRAMES,
    PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
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

  if (organization.features.includes('mobile-vitals')) {
    tripleChartRowCharts.push(
      ...[
        PerformanceWidgetSetting.TIME_TO_INITIAL_DISPLAY,
        PerformanceWidgetSetting.TIME_TO_FULL_DISPLAY,
      ]
    );
  }
  if (organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts[0] = PerformanceWidgetSetting.SLOW_SCREENS_BY_TTID;
  }
  if (organization.features.includes('starfish-mobile-appstart')) {
    doubleChartRowCharts.push(
      PerformanceWidgetSetting.SLOW_SCREENS_BY_COLD_START,
      PerformanceWidgetSetting.SLOW_SCREENS_BY_WARM_START
    );
  }

  if (organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts.push(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
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
    trackAnalytics('performance.domains.mobile.search', {organization});

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

  const {query: searchBarQuery} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

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
      cursor,
      useQueryOptions: {additonalQueryKey: STARRED_SEGMENT_TABLE_QUERY_KEY},
      fields: [
        'is_starred_transaction',
        'transaction',
        'span.op',
        'project',
        'epm()',
        'p75(measurements.frames_slow_rate)',
        'p75(measurements.frames_frozen_rate)',
        'count_unique(user)',
        'sum(span.duration)',
      ],
    },
    'api.performance.landing-table'
  );

  const searchBarProjectsIds = [...selectedMobileProjects, ...selectedOtherProjects].map(
    project => project.id
  );

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <MobileHeader headerTitle={MOBILE_LANDING_TITLE} />
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
            <ModuleLayout.Full>
              {showOnboarding ? (
                <LegacyOnboarding
                  project={onboardingProject}
                  organization={organization}
                />
              ) : (
                <PerformanceDisplayProvider
                  value={{performanceType: ProjectPerformanceType.MOBILE}}
                >
                  <DoubleChartRow
                    allowedCharts={doubleChartRowCharts}
                    {...sharedProps}
                    eventView={doubleChartRowEventView}
                  />
                  <TripleChartRow allowedCharts={tripleChartRowCharts} {...sharedProps} />
                  <MobileOverviewTable response={response} sort={sorts[1]} />
                </PerformanceDisplayProvider>
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

function MobileOverviewPageWithProviders() {
  const useEap = useInsightsEap();
  return (
    <DomainOverviewPageProviders>
      {useEap ? <EAPMobileOverviewPage /> : <OldMobileOverviewPage />}
    </DomainOverviewPageProviders>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default MobileOverviewPageWithProviders;
