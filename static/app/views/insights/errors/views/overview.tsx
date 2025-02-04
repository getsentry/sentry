import React from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

export function ErrorsOverview() {
  const headerProps = {
    module: ModuleName.ERRORS,
  };

  const {view} = useDomainViewFilters();
  return (
    <React.Fragment>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}

      <ModuleBodyUpsellHook moduleName={ModuleName.ERRORS}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ToolRibbon>
                  <ModulePageFilterBar
                    moduleName={ModuleName.ERRORS}
                    extraFilters={<SubregionSelector />}
                  />
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModulesOnboarding moduleName={ModuleName.ERRORS}>
                {
                  // TODO: charts go here
                  null
                }
              </ModulesOnboarding>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="http" analyticEventName="insight.page_loads.errors">
      <ErrorsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
