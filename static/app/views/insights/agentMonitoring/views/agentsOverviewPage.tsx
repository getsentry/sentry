import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {AgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function AgentsMonitoringPage() {
  return (
    <Layout.Page>
      <AgentsPageHeader module={ModuleName.AGENTS} />
      <ModuleBodyUpsellHook moduleName={ModuleName.AGENTS}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ModulePageFilterBar moduleName={ModuleName.AGENTS} />
              </ModuleLayout.Full>
              <ModuleLayout.Full>
                <DashboardPlaceholder>Agent Monitoring Dashboard</DashboardPlaceholder>
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <AgentInsightsFeature>
      <ModulePageProviders
        moduleName={ModuleName.AGENTS}
        analyticEventName="insight.page_loads.agents"
      >
        <AgentsMonitoringPage />
      </ModulePageProviders>
    </AgentInsightsFeature>
  );
}

const DashboardPlaceholder = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
`;

export default PageWithProviders;
