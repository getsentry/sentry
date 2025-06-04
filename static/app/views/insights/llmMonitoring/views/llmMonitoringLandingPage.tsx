import * as Layout from 'sentry/components/layouts/thirds';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import LlmNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/llmNumberOfPipelinesChartWidget';
import LlmPipelineDurationChartWidget from 'sentry/views/insights/common/components/widgets/llmPipelineDurationChartWidget';
import LlmTotalTokensUsedChart from 'sentry/views/insights/common/components/widgets/llmTotalTokensUsedChartWidget';
import {PipelinesTable} from 'sentry/views/insights/llmMonitoring/components/tables/pipelinesTable';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function LLMMonitoringPage() {
  return (
    <Layout.Page>
      <AiHeader module={ModuleName.AI} />
      <ModuleBodyUpsellHook moduleName={ModuleName.AI}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
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
  return (
    <ModulePageProviders moduleName="ai" analyticEventName="insight.page_loads.ai">
      <LLMMonitoringPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
