import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {ChartPlacementSlot} from 'sentry/views/insights/sessions/components/chartPlacement';
import FilterReleaseDropdown from 'sentry/views/insights/sessions/components/filterReleaseDropdown';
import ReleaseTableSearch from 'sentry/views/insights/sessions/components/releaseTableSearch';
import ReleaseHealth from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import useProjectHasSessions from 'sentry/views/insights/sessions/queries/useProjectHasSessions';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const {view = ''} = useDomainViewFilters();
  const [filters, setFilters] = useState<string[]>(['']);

  // only show onboarding if the project does not have session data
  const {hasSessionData} = useProjectHasSessions();
  const showOnboarding = !hasSessionData;

  return (
    <Fragment>
      <ViewSpecificHeader view={view} />
      <Layout.Body>
        <Layout.Main fullWidth>
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
    </Fragment>
  );
}

function ViewSpecificHeader({view}: {view: DomainView | ''}) {
  switch (view) {
    case FRONTEND_LANDING_SUB_PATH:
      return <FrontendHeader module={ModuleName.SESSIONS} />;
    case MOBILE_LANDING_SUB_PATH:
      return <MobileHeader module={ModuleName.SESSIONS} />;
    default:
      return null;
  }
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
  return (
    <ModulePageProviders moduleName="sessions">
      <SessionsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const FilterWrapper = styled('div')`
  margin: ${space(2)} 0;
  gap: ${space(1)};
  display: grid;
  grid-template-columns: auto 1fr;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-rows: auto auto;
  }
`;
