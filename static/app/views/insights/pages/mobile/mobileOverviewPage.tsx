import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
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
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {
  generateGenericPerformanceEventView,
  generateMobilePerformanceEventView,
} from 'sentry/views/performance/data';
import {checkIsReactNative} from 'sentry/views/performance/landing/utils';
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

const MOBILE_COLUMN_TITLES = [
  'transaction',
  'operation',
  'project',
  'tpm',
  'slow frame %',
  'frozen frame %',
  'users',
  'user misery',
];

const REACT_NATIVE_COLUMN_TITLES = [
  'transaction',
  'operation',
  'project',
  'tpm',
  'slow frame %',
  'frozen frame %',
  'stall %',
  'users',
  'user misery',
];

function MobileOverviewPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {setPageError} = usePageAlert();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);

  const eventView = generateMobilePerformanceEventView(
    location,
    projects,
    generateGenericPerformanceEventView(location, withStaticFilters, organization),
    withStaticFilters,
    organization
  );

  let columnTitles = checkIsReactNative(eventView)
    ? REACT_NATIVE_COLUMN_TITLES
    : MOBILE_COLUMN_TITLES;

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.MOST_SLOW_FRAMES,
    PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
  ];
  const tripleChartRowCharts = [
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.DURATION_HISTOGRAM,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
    PerformanceWidgetSetting.FAILURE_RATE_AREA,
  ];

  if (organization.features.includes('mobile-vitals')) {
    columnTitles = [...columnTitles.slice(0, 5), 'ttid', ...columnTitles.slice(5, 0)];
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

  const derivedQuery = getTransactionSearchQuery(location, eventView.query);

  return (
    <Feature
      features="insights-domain-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <MobileHeader headerActions={<ViewTrendsButton />} />
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
                  value={{performanceType: ProjectPerformanceType.MOBILE}}
                >
                  <DoubleChartRow allowedCharts={doubleChartRowCharts} {...sharedProps} />
                  <TripleChartRow allowedCharts={tripleChartRowCharts} {...sharedProps} />
                  <Table
                    projects={projects}
                    columnTitles={columnTitles}
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

function MobileOverviewPageWithProviders() {
  const organization = useOrganization();

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={OVERVIEW_PAGE_TITLE} orgSlug={organization.slug}>
        <MobileOverviewPage />
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

export default MobileOverviewPageWithProviders;
