import React, {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionChart from 'sentry/views/insights/sessions/charts/crashFreeSessionChart';
import ErrorFreeSessionsChart from 'sentry/views/insights/sessions/charts/errorFreeSessionsChart';
import SessionHealthCountChart from 'sentry/views/insights/sessions/charts/sessionHealthCountChart';
import SessionHealthRateChart from 'sentry/views/insights/sessions/charts/sessionHealthRateChart';
import UserHealthCountChart from 'sentry/views/insights/sessions/charts/userHealthCountChart';
import UserHealthRateChart from 'sentry/views/insights/sessions/charts/userHealthRateChart';
import FilterReleaseDropdown from 'sentry/views/insights/sessions/components/filterReleaseDropdown';
import ReleaseAdoption from 'sentry/views/insights/sessions/components/tables/releaseAdoption';
import ReleaseHealth from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const headerProps = {
    module: ModuleName.SESSIONS,
  };

  const {view} = useDomainViewFilters();
  const [filters, setFilters] = useState<string[]>(['']);

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
                <Alert type="info" icon={<IconInfo />} showIcon>
                  {t(
                    `This page is a temporary spot to put experimental release charts and tables currently in development. We will move things around eventually, but for now, it's a spot where we can put everything and get quick feedback.`
                  )}
                </Alert>
              </ToolRibbon>
            </ModuleLayout.Full>
            {view === MOBILE_LANDING_SUB_PATH && (
              <Fragment>
                <ModuleLayout.Third>
                  <CrashFreeSessionChart />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <SessionHealthRateChart />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <SessionHealthCountChart />
                </ModuleLayout.Third>
                <ModuleLayout.Half>
                  <UserHealthCountChart />
                </ModuleLayout.Half>
                <ModuleLayout.Half>
                  <UserHealthRateChart />
                </ModuleLayout.Half>
                <ModuleLayout.Full>
                  <FilterWrapper>
                    <FilterReleaseDropdown filters={filters} setFilters={setFilters} />
                  </FilterWrapper>
                  <ReleaseAdoption filters={filters} />
                  <ReleaseHealth filters={filters} />
                </ModuleLayout.Full>
              </Fragment>
            )}
            {view === FRONTEND_LANDING_SUB_PATH && (
              <Fragment>
                <ModuleLayout.Third>
                  <ErrorFreeSessionsChart />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <SessionHealthRateChart />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <SessionHealthCountChart />
                </ModuleLayout.Third>
                <ModuleLayout.Half>
                  <UserHealthCountChart />
                </ModuleLayout.Half>
                <ModuleLayout.Half>
                  <UserHealthRateChart />
                </ModuleLayout.Half>
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
