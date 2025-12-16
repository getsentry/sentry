import {Fragment, useEffect} from 'react';

import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
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

interface McpOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function McpOverviewPage({datePageFilterProps}: McpOverviewPageProps) {
  const organization = useOrganization();
  const showOnboarding = useShowMCPOnboarding();

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
                      <TraceItemSearchQueryBuilder {...mcpSpanSearchProps.queryBuilder} />
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
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <DomainOverviewPageProviders maxPickableDays={datePageFilterProps.maxPickableDays}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <McpOverviewPage datePageFilterProps={datePageFilterProps} />
      </TraceItemAttributeProvider>
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
