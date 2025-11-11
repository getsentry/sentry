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
import McpResourceDurationWidget from 'sentry/views/insights/pages/mcp/components/mcpResourceDurationWidget';
import McpResourceErrorRateWidget from 'sentry/views/insights/pages/mcp/components/mcpResourceErrorRateWidget';
import {McpResourcesTable} from 'sentry/views/insights/pages/mcp/components/mcpResourcesTable';
import McpResourceTrafficWidget from 'sentry/views/insights/pages/mcp/components/mcpResourceTrafficWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/mcp/components/styles';
import {useMcpSpanSearchProps} from 'sentry/views/insights/pages/mcp/hooks/useMcpSpanSearchProps';
import {useShowMCPOnboarding} from 'sentry/views/insights/pages/mcp/hooks/useShowMCPOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/mcp/onboarding';
import {ModuleName} from 'sentry/views/insights/types';

function McpResourcesLandingPage() {
  const organization = useOrganization();
  const showOnboarding = useShowMCPOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);

  const mcpSpanSearchProps = useMcpSpanSearchProps();

  return (
    <SearchQueryBuilderProvider {...mcpSpanSearchProps.provider}>
      <ModuleFeature moduleName={ModuleName.MCP_RESOURCES}>
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
                        <McpResourceTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <McpResourceDurationWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <McpResourceErrorRateWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <McpResourcesTable />
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
      moduleName={ModuleName.MCP_RESOURCES}
      analyticEventName="insight.page_loads.mcp_resources"
    >
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <McpResourcesLandingPage />
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;
