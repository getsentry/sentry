import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import * as Layout from 'sentry/components/layouts/thirds';
import Redirect from 'sentry/components/redirect';
import {tct} from 'sentry/locale';
import {AiModuleToggleButton} from 'sentry/views/insights/agentMonitoring/components/aiModuleToggleButton';
import {
  usePreferedAiModule,
  useTogglePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import LlmNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/llmNumberOfPipelinesChartWidget';
import LlmPipelineDurationChartWidget from 'sentry/views/insights/common/components/widgets/llmPipelineDurationChartWidget';
import LlmTotalTokensUsedChart from 'sentry/views/insights/common/components/widgets/llmTotalTokensUsedChartWidget';
import {PipelinesTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelinesTable';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

function LLMMonitoringPage() {
  const [, togglePreferedModule] = useTogglePreferedAiModule();
  return (
    <Layout.Page>
      <AiHeader module={ModuleName.AI} headerActions={<AiModuleToggleButton />} />
      <ModuleBodyUpsellHook moduleName={ModuleName.AI}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <DeprecatedModuleLayout type="error">
                  {tct(
                    'On 4th August 2025, LLM Monitoring will be sunset and replaced by the new AI Agent Monitoring. [link:Switch to the new experience].',
                    {
                      link: <Link onClick={togglePreferedModule} to={''} />,
                    }
                  )}
                </DeprecatedModuleLayout>
                <ModulePageFilterBar moduleName={ModuleName.AI} />
              </ModuleLayout.Full>
              <ModulesOnboarding moduleName={ModuleName.AI}>
                <ModuleLayout.Third>
                  <LlmTotalTokensUsedChart />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <LlmNumberOfPipelinesChartWidget />
                </ModuleLayout.Third>
                <ModuleLayout.Third>
                  <LlmPipelineDurationChartWidget />
                </ModuleLayout.Third>
                <ModuleLayout.Full>
                  <PipelinesTable />
                </ModuleLayout.Full>
              </ModulesOnboarding>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </Layout.Page>
  );
}

function PageWithProviders() {
  const preferedAiModule = usePreferedAiModule();

  if (preferedAiModule === 'agents-insights') {
    return <Redirect to={`/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/`} />;
  }

  return (
    <ModulePageProviders moduleName="ai" analyticEventName="insight.page_loads.ai">
      <LLMMonitoringPage />
    </ModulePageProviders>
  );
}

const DeprecatedModuleLayout = styled(Alert)`
  margin-bottom: ${p => p.theme.space.xl};
`;

export default PageWithProviders;
