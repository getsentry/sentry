import {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {TwoColumnWidgetGrid} from 'sentry/views/insights/pages/agents/components/styles';
import ToolUsageWidget from 'sentry/views/insights/pages/agents/components/toolCallsWidget';
import ToolErrorsWidget from 'sentry/views/insights/pages/agents/components/toolErrorsWidget';
import {ToolsTable} from 'sentry/views/insights/pages/agents/components/toolsTable';
import {useAgentMonitoringTrackPageView} from 'sentry/views/insights/pages/agents/hooks/useAgentMonitoringTrackPageView';
import {useAgentSpanSearchProps} from 'sentry/views/insights/pages/agents/hooks/useAgentSpanSearchProps';
import {useShowAgentOnboarding} from 'sentry/views/insights/pages/agents/hooks/useShowAgentOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {ModuleName} from 'sentry/views/insights/types';

interface AgentToolsLandingPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function AgentToolsLandingPage({datePageFilterProps}: AgentToolsLandingPageProps) {
  const showOnboarding = useShowAgentOnboarding();
  useDefaultToAllProjects();

  const agentSpanSearchProps = useAgentSpanSearchProps();

  useAgentMonitoringTrackPageView();

  return (
    <SearchQueryBuilderProvider {...agentSpanSearchProps.provider}>
      <ModuleFeature moduleName={ModuleName.AGENT_TOOLS}>
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
                      <TraceItemSearchQueryBuilder
                        {...agentSpanSearchProps.queryBuilder}
                      />
                    </Flex>
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                {showOnboarding ? (
                  <Onboarding />
                ) : (
                  <Fragment>
                    <TwoColumnWidgetGrid rowHeight={260}>
                      <TwoColumnWidgetGrid.Position1>
                        <ToolUsageWidget />
                      </TwoColumnWidgetGrid.Position1>
                      <TwoColumnWidgetGrid.Position2>
                        <ToolErrorsWidget />
                      </TwoColumnWidgetGrid.Position2>
                    </TwoColumnWidgetGrid>
                    <ToolsTable />
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
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <ModulePageProviders
      moduleName={ModuleName.AGENT_TOOLS}
      analyticEventName="insight.page_loads.agent_tools"
      maxPickableDays={datePageFilterProps.maxPickableDays}
    >
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <AgentToolsLandingPage datePageFilterProps={datePageFilterProps} />
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;
