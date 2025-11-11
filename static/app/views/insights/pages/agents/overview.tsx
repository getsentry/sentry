import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Flex, Stack} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {ConversationsTable} from 'sentry/views/insights/pages/agents/components/conversationsTable';
import {
  ConversationsTableSwitch,
  useConversationsTableSwitch,
} from 'sentry/views/insights/pages/agents/components/conversationsTableSwitch';
import {IssuesWidget} from 'sentry/views/insights/pages/agents/components/issuesWidget';
import LLMGenerationsWidget from 'sentry/views/insights/pages/agents/components/llmCallsWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/agents/components/styles';
import TokenUsageWidget from 'sentry/views/insights/pages/agents/components/tokenUsageWidget';
import ToolUsageWidget from 'sentry/views/insights/pages/agents/components/toolCallsWidget';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';
import {useAgentSpanSearchProps} from 'sentry/views/insights/pages/agents/hooks/useAgentSpanSearchProps';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  return !selectedProjects.some(p => p.hasInsightsAgentMonitoring);
}

function AgentsOverviewPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  useDefaultToAllProjects();

  const {value: conversationTable} = useConversationsTableSwitch();
  const agentSpanSearchProps = useAgentSpanSearchProps();

  useOverviewPageTrackPageload();

  // Fire a request to check if there are any agent runs
  // If there are, we show the count/duration of agent runs
  // If there are not, we show the count/duration of all AI spans
  const agentRunsRequest = useSpans(
    {
      search: 'span.op:"gen_ai.invoke_agent"',
      fields: ['id'],
      limit: 1,
    },
    Referrer.AGENT_RUNS_WIDGET
  );

  const hasAgentRuns = agentRunsRequest.isLoading
    ? undefined
    : agentRunsRequest.data?.length > 0;

  return (
    <SearchQueryBuilderProvider {...agentSpanSearchProps.provider}>
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
                  <Stack gap="xl">
                    <WidgetGrid rowHeight={210} paddingBottom={0}>
                      <WidgetGrid.Position1>
                        {hasAgentRuns === undefined ? (
                          <LoadingPanel />
                        ) : (
                          <OverviewAgentsRunsChartWidget hasAgentRuns={hasAgentRuns} />
                        )}
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        {hasAgentRuns === undefined ? (
                          <LoadingPanel />
                        ) : (
                          <OverviewAgentsDurationChartWidget
                            hasAgentRuns={hasAgentRuns}
                          />
                        )}
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <IssuesWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <WidgetGrid rowHeight={260} paddingBottom={0}>
                      <WidgetGrid.Position1>
                        <LLMGenerationsWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <TokenUsageWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <ToolUsageWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <Flex justify="end">
                      <ConversationsTableSwitch />
                    </Flex>
                    {conversationTable ? <ConversationsTable /> : <TracesTable />}
                  </Stack>
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
        <AgentsOverviewPage />
      </TraceItemAttributeProvider>
    </DomainOverviewPageProviders>
  );
}

function LoadingPanel() {
  return (
    <Stack
      position="relative"
      justify="center"
      gap="md"
      height="100%"
      border="primary"
      radius="md"
    >
      <LoadingMask visible />
      <LoadingIndicator size={24} />
    </Stack>
  );
}

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.background};
`;

export default PageWithProviders;
