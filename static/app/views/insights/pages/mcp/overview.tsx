import {Fragment, useEffect} from 'react';

import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import McpTrafficWidget from 'sentry/views/insights/common/components/widgets/mcpTrafficWidget';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {McpOverviewTable} from 'sentry/views/insights/pages/mcp/components/mcpOverviewTable';
import McpPromptTrafficWidget from 'sentry/views/insights/pages/mcp/components/mcpPromptTrafficWidget';
import McpResourceTrafficWidget from 'sentry/views/insights/pages/mcp/components/mcpResourceTrafficWidget';
import McpToolTrafficWidget from 'sentry/views/insights/pages/mcp/components/mcpToolTrafficWidget';
import McpTrafficByClientWidget from 'sentry/views/insights/pages/mcp/components/mcpTrafficByClientWidget';
import McpTransportWidget from 'sentry/views/insights/pages/mcp/components/mcpTransportWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/mcp/components/styles';
import {useMcpSpanSearchProps} from 'sentry/views/insights/pages/mcp/hooks/useMcpSpanSearchProps';
import {useShowMCPOnboarding} from 'sentry/views/insights/pages/mcp/hooks/useShowMCPOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/mcp/onboarding';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function McpOverviewPage() {
  const organization = useOrganization();
  const showOnboarding = useShowMCPOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);

  useOverviewPageTrackPageload();

  useEffect(() => {
    trackAnalytics('mcp-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);

  const mcpSpanSearchProps = useMcpSpanSearchProps();

  return (
    <SearchQueryBuilderProvider {...mcpSpanSearchProps.provider}>
      <Feature
        features="performance-view"
        organization={organization}
        renderDisabled={NoAccess}
      >
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
                        <McpTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <McpTrafficByClientWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <McpTransportWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <WidgetGrid>
                      <WidgetGrid.Position1>
                        <McpToolTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <McpResourceTrafficWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <McpPromptTrafficWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <McpOverviewTable />
                  </Fragment>
                )}
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </Feature>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  return (
    <DomainOverviewPageProviders>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <McpOverviewPage />
      </TraceItemAttributeProvider>
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
