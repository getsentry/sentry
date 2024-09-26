import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert, usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {useFilters} from 'sentry/views/insights/pages/useFilters';
import type {ModuleName} from 'sentry/views/insights/types';
import {generateFrontendOtherPerformanceEventView} from 'sentry/views/performance/data';
import {FRONTEND_OTHER_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Onboarding from 'sentry/views/performance/onboarding';
import Table from 'sentry/views/performance/table';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

function FrontendLandingPage() {
  const filters = useFilters();
  const organization = useOrganization();
  const location = useLocation();
  const {setPageError} = usePageAlert();
  const {projects} = useProjects();
  const onboardingProject = useOnboardingProject();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateFrontendOtherPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );

  const showOnboarding = onboardingProject !== undefined;

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
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

  if (organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES);
  }

  const sharedProps = {eventView, location, organization, withStaticFilters};

  if (showOnboarding) {
    return <Onboarding project={onboardingProject} organization={organization} />;
  }

  return (
    <Fragment>
      <Layout.Header>
        <FrontendHeader module={filters.module as ModuleName} />
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Full>
            <ToolRibbon>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ToolRibbon>
          </ModuleLayout.Full>
          <PageAlert />
          <PerformanceDisplayProvider
            value={{performanceType: ProjectPerformanceType.FRONTEND_OTHER}}
          >
            <div data-test-id="frontend-other-view">
              <DoubleChartRow allowedCharts={doubleChartRowCharts} {...sharedProps} />
              <TripleChartRow allowedCharts={tripleChartRowCharts} {...sharedProps} />
              <Table
                projects={projects}
                columnTitles={FRONTEND_OTHER_COLUMN_TITLES}
                setError={setPageError}
                {...sharedProps}
              />
            </div>
          </PerformanceDisplayProvider>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function FrontendLandingPageWithProviders() {
  const organization = useOrganization();

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={OVERVIEW_PAGE_TITLE} orgSlug={organization.slug}>
        <FrontendLandingPage />
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

const SearchContainerWithFilter = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr;
  }
`;

export default FrontendLandingPageWithProviders;
