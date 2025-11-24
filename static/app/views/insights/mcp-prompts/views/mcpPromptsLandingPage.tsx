import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

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
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import McpPromptDurationWidget from 'sentry/views/insights/pages/mcp/components/mcpPromptDurationWidget';
import McpPromptErrorRateWidget from 'sentry/views/insights/pages/mcp/components/mcpPromptErrorRateWidget';
import {McpPromptsTable} from 'sentry/views/insights/pages/mcp/components/mcpPromptsTable';
import McpPromptTrafficWidget from 'sentry/views/insights/pages/mcp/components/mcpPromptTrafficWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/mcp/components/styles';
import {useMcpSpanSearchProps} from 'sentry/views/insights/pages/mcp/hooks/useMcpSpanSearchProps';
import {useShowMCPOnboarding} from 'sentry/views/insights/pages/mcp/hooks/useShowMCPOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/mcp/onboarding';
import {ModuleName} from 'sentry/views/insights/types';

function McpPromptsLandingPage() {
  const organization = useOrganization();
  const showOnboarding = useShowMCPOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);

  const mcpSpanSearchProps = useMcpSpanSearchProps();

  return (
    <SearchQueryBuilderProvider {...mcpSpanSearchProps.provider}>
      <ModuleFeature moduleName={ModuleName.MCP_PROMPTS}>
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
                    <DatePageFilter {...datePageFilterProps} />
                  </PageFilterBar>
                  {!showOnboarding && (
                    <Flex flex={2}>
                      <EAPSpanSearchQueryBuilder {...mcpSpanSearchProps.queryBuilder} />
                    </Flex>
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                {showOnboarding ? (
                  <Onboarding />
                ) : (
                  <Fragment>
                    <WidgetGrid>
                      <WidgetGrid.Position1>
                        <McpPromptTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <McpPromptDurationWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <McpPromptErrorRateWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <McpPromptsTable />
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
      moduleName={ModuleName.MCP_PROMPTS}
      analyticEventName="insight.page_loads.mcp_prompts"
    >
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <McpPromptsLandingPage />
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;
