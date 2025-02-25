import React from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
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
import ReleaseAdoption from 'sentry/views/insights/sessions/components/tables/releaseAdoption';
import ReleaseHealth from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const headerProps = {
    module: ModuleName.SESSIONS,
  };

  const {view} = useDomainViewFilters();

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
                />
              </ToolRibbon>
            </ModuleLayout.Full>
            {view === MOBILE_LANDING_SUB_PATH ? (
              <ModuleLayout.Half>
                <CrashFreeSessionChart />
              </ModuleLayout.Half>
            ) : (
              <ModuleLayout.Third>
                <ErrorFreeSessionsChart />
              </ModuleLayout.Third>
            )}
            <ModuleLayout.Full>
              <ReleaseAdoption />
              <ReleaseHealth />
            </ModuleLayout.Full>
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
