import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useHasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {
  useDomainViewFilters,
  type DomainView,
} from 'sentry/views/insights/pages/useFilters';
import {ChartPlacementSlot} from 'sentry/views/insights/sessions/components/chartPlacement';
import {FilterReleaseDropdown} from 'sentry/views/insights/sessions/components/filterReleaseDropdown';
import {ReleaseTableSearch} from 'sentry/views/insights/sessions/components/releaseTableSearch';
import {ReleaseHealth} from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import {useProjectHasSessions} from 'sentry/views/insights/sessions/queries/useProjectHasSessions';
import {PlatformizedMobileSessionsOverview} from 'sentry/views/insights/sessions/views/platformizedMobileOverview';
import {PlatformizedSessionsOverview} from 'sentry/views/insights/sessions/views/platformizedOverview';
import {ModuleName} from 'sentry/views/insights/types';

function SessionsOverview() {
  const {view = ''} = useDomainViewFilters();
  const [filters, setFilters] = useState<string[]>(['']);

  // only show onboarding if the project does not have session data
  const {hasSessionData} = useProjectHasSessions();
  const showOnboarding = !hasSessionData;

  return (
    <Layout.Page>
      <Layout.Body>
        <Layout.Main width="full">
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar>
                  <ProjectPageFilter resetParamsOnChange={['cursor']} />
                  <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                  <DatePageFilter />
                </PageFilterBar>
              </ToolRibbon>
            </ModuleLayout.Full>
            {showOnboarding ? (
              <ModuleLayout.Full>
                <ModulesOnboardingPanel moduleName={ModuleName.SESSIONS} />
              </ModuleLayout.Full>
            ) : (
              <ViewSpecificCharts view={view} filters={filters} setFilters={setFilters} />
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function ViewSpecificCharts({
  view,
  filters,
  setFilters,
}: {
  filters: string[];
  setFilters: (filter: string[]) => void;
  view: DomainView | '';
}) {
  switch (view) {
    case FRONTEND_LANDING_SUB_PATH: {
      return (
        <Fragment>
          <ModuleLayout.Half>
            <ChartPlacementSlot view={view} index={0} />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <ChartPlacementSlot view={view} index={1} />
          </ModuleLayout.Half>

          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={2} />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={3} />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={4} />
          </ModuleLayout.Third>
        </Fragment>
      );
    }
    case MOBILE_LANDING_SUB_PATH: {
      return (
        <Fragment>
          <ModuleLayout.Half>
            <ChartPlacementSlot view={view} index={0} />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <ChartPlacementSlot view={view} index={1} />
          </ModuleLayout.Half>

          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={2} />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={3} />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <ChartPlacementSlot view={view} index={4} />
          </ModuleLayout.Third>

          <ModuleLayout.Full>
            <FilterWrapper>
              <FilterReleaseDropdown filters={filters} setFilters={setFilters} />
              <ReleaseTableSearch />
            </FilterWrapper>
            <ReleaseHealth filters={filters} />
          </ModuleLayout.Full>
        </Fragment>
      );
    }
    default:
      return null;
  }
}

function PageWithProviders() {
  const {view = ''} = useDomainViewFilters();
  const hasPlatformizedInsights = useHasPlatformizedInsights();

  if (hasPlatformizedInsights && view === FRONTEND_LANDING_SUB_PATH) {
    return <PlatformizedSessionsOverview />;
  }

  if (hasPlatformizedInsights && view === MOBILE_LANDING_SUB_PATH) {
    return <PlatformizedMobileSessionsOverview />;
  }
  return (
    <ModulePageProviders moduleName="sessions">
      <SessionsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const FilterWrapper = styled('div')`
  margin: ${p => p.theme.space.xl} 0;
  gap: ${p => p.theme.space.md};
  display: grid;
  grid-template-columns: auto 1fr;
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-rows: auto auto;
  }
`;
