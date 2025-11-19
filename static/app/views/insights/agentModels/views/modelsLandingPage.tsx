import {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import TokenCostWidget from 'sentry/views/insights/pages/agents/components/modelCostWidget';
import {ModelsTable} from 'sentry/views/insights/pages/agents/components/modelsTable';
import {WidgetGrid} from 'sentry/views/insights/pages/agents/components/styles';
import TokenTypesWidget from 'sentry/views/insights/pages/agents/components/tokenTypesWidget';
import TokenUsageWidget from 'sentry/views/insights/pages/agents/components/tokenUsageWidget';
import {useAgentSpanSearchProps} from 'sentry/views/insights/pages/agents/hooks/useAgentSpanSearchProps';
import {useShowAgentOnboarding} from 'sentry/views/insights/pages/agents/hooks/useShowAgentOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {ModuleName} from 'sentry/views/insights/types';

function AgentModelsLandingPage() {
  const organization = useOrganization();
  const showOnboarding = useShowAgentOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  useDefaultToAllProjects();

  const agentSpanSearchProps = useAgentSpanSearchProps();

  return (
    <SearchQueryBuilderProvider {...agentSpanSearchProps.provider}>
      <ModuleFeature moduleName={ModuleName.AGENT_MODELS}>
        <Layout.Body>
          <Layout.Main width="full">
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <InsightsProjectSelector
                      resetParamsOnChange={[TableUrlParams.CURSOR]}
                    />
                    <InsightsEnvironmentSelector
                      resetParamsOnChange={[TableUrlParams.CURSOR]}
                    />
                    <DatePageFilter
                      {...datePageFilterProps}
                      resetParamsOnChange={[TableUrlParams.CURSOR]}
                    />
                  </PageFilterBar>
                  {!showOnboarding && (
                    <Flex flex={2}>
                      <EAPSpanSearchQueryBuilder {...agentSpanSearchProps.queryBuilder} />
                    </Flex>
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                {showOnboarding ? (
                  <Onboarding />
                ) : (
                  <Fragment>
                    <WidgetGrid rowHeight={260}>
                      <WidgetGrid.Position1>
                        <TokenCostWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <TokenUsageWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <TokenTypesWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <ModelsTable />
                  </Fragment>
                )}
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleFeature>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName={ModuleName.AGENT_MODELS}
      analyticEventName="insight.page_loads.agent_models"
    >
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <AgentModelsLandingPage />
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;
