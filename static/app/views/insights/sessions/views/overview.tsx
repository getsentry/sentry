import React, {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionsChart from 'sentry/views/insights/sessions/charts/crashFreeSessionsChart';
import ErrorFreeSessionsChart from 'sentry/views/insights/sessions/charts/errorFreeSessionsChart';
import ReleaseSessionCountChart from 'sentry/views/insights/sessions/charts/releaseSessionCountChart';
import ReleaseSessionPercentageChart from 'sentry/views/insights/sessions/charts/releaseSessionPercentageChart';
import SessionHealthCountChart from 'sentry/views/insights/sessions/charts/sessionHealthCountChart';
import SessionHealthRateChart from 'sentry/views/insights/sessions/charts/sessionHealthRateChart';
import UserHealthCountChart from 'sentry/views/insights/sessions/charts/userHealthCountChart';
import UserHealthRateChart from 'sentry/views/insights/sessions/charts/userHealthRateChart';
import FilterReleaseDropdown from 'sentry/views/insights/sessions/components/filterReleaseDropdown';
import ReleaseHealth from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import useProjectHasSessions from 'sentry/views/insights/sessions/queries/useProjectHasSessions';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const headerProps = {
    module: ModuleName.SESSIONS,
  };

  const {view = ''} = useDomainViewFilters();

  const [filters, setFilters] = useState<string[]>(['']);

  // only show onboarding if the project does not have session data
  const hasSessionData = useProjectHasSessions();
  const showOnboarding = !hasSessionData;

  const SESSION_HEALTH_CHARTS = (
    <Fragment>
      {view === FRONTEND_LANDING_SUB_PATH ? (
        <ModuleLayout.Third>
          <ErrorFreeSessionsChart />
        </ModuleLayout.Third>
      ) : view === MOBILE_LANDING_SUB_PATH ? (
        <ModuleLayout.Third>
          <CrashFreeSessionsChart />
        </ModuleLayout.Third>
      ) : undefined}
      <ModuleLayout.Third>
        <SessionHealthCountChart view={view} />
      </ModuleLayout.Third>
      <ModuleLayout.Third>
        <UserHealthCountChart view={view} />
      </ModuleLayout.Third>
      <ModuleLayout.Third />
      <ModuleLayout.Third>
        <SessionHealthRateChart view={view} />
      </ModuleLayout.Third>
      <ModuleLayout.Third>
        <UserHealthRateChart view={view} />
      </ModuleLayout.Third>
    </Fragment>
  );

  return (
    <React.Fragment>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      {view === BACKEND_LANDING_SUB_PATH && <BackendHeader {...headerProps} />}
      {view === MOBILE_LANDING_SUB_PATH && <MobileHeader {...headerProps} />}
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <ModulePageFilterBar
                  moduleName={ModuleName.SESSIONS}
                  extraFilters={<SubregionSelector />}
                  onProjectChange={() => {
                    setFilters(['']);
                  }}
                />
              </ToolRibbon>
            </ModuleLayout.Full>
            {showOnboarding ? (
              <ModuleLayout.Full>
                <ModulesOnboardingPanel moduleName={ModuleName.SESSIONS} />
              </ModuleLayout.Full>
            ) : (
              <Fragment>
                {view === MOBILE_LANDING_SUB_PATH && (
                  <Fragment>
                    {SESSION_HEALTH_CHARTS}
                    <ModuleLayout.Half>
                      <ReleaseSessionCountChart />
                    </ModuleLayout.Half>
                    <ModuleLayout.Half>
                      <ReleaseSessionPercentageChart />
                    </ModuleLayout.Half>
                    <ModuleLayout.Full>
                      <FilterWrapper>
                        <FilterReleaseDropdown
                          filters={filters}
                          setFilters={setFilters}
                        />
                      </FilterWrapper>
                      <ReleaseHealth filters={filters} />
                    </ModuleLayout.Full>
                  </Fragment>
                )}
                {view === FRONTEND_LANDING_SUB_PATH && SESSION_HEALTH_CHARTS}
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="http"
      analyticEventName="insight.page_loads.sessions"
    >
      <SessionsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const FilterWrapper = styled('div')`
  display: flex;
  margin: ${space(2)} 0;
`;
