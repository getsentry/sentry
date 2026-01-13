import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {useDismissable} from 'sentry/components/banner';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex, Stack} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {NoAccess} from 'sentry/components/noAccess';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconClose} from 'sentry/icons';
import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {IssuesWidget} from 'sentry/views/insights/pages/agents/components/issuesWidget';
import LLMGenerationsWidget from 'sentry/views/insights/pages/agents/components/llmCallsWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/agents/components/styles';
import TokenUsageWidget from 'sentry/views/insights/pages/agents/components/tokenUsageWidget';
import ToolUsageWidget from 'sentry/views/insights/pages/agents/components/toolCallsWidget';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';
import {useAgentMonitoringTrackPageView} from 'sentry/views/insights/pages/agents/hooks/useAgentMonitoringTrackPageView';
import {useAgentSpanSearchProps} from 'sentry/views/insights/pages/agents/hooks/useAgentSpanSearchProps';
import {useShowAgentOnboarding} from 'sentry/views/insights/pages/agents/hooks/useShowAgentOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {getAgentRunsFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

interface AgentsOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function AgentsOverviewPage({datePageFilterProps}: AgentsOverviewPageProps) {
  const organization = useOrganization();
  const showOnboarding = useShowAgentOnboarding();
  useDefaultToAllProjects();

  const agentSpanSearchProps = useAgentSpanSearchProps();
  const isSentryEmployee = useIsSentryEmployee();
  const pageFilters = usePageFilters();
  const [dismissed, dismiss] = useDismissable('agents-overview-seer-data-banner');

  const showSeerDataBanner =
    isSentryEmployee && !dismissed && pageFilters.selection.projects.includes(6178942);

  useOverviewPageTrackPageload();
  useAgentMonitoringTrackPageView();

  // Fire a request to check if there are any agent runs
  // If there are, we show the count/duration of agent runs
  // If there are not, we show the count/duration of all AI spans
  const agentRunsRequest = useSpans(
    {
      search: getAgentRunsFilter(),
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
                      <TraceItemSearchQueryBuilder
                        {...agentSpanSearchProps.queryBuilder}
                      />
                    </Flex>
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              {showSeerDataBanner && (
                <ModuleLayout.Full>
                  <Alert
                    variant="info"
                    trailingItems={
                      <Button
                        aria-label="Dismiss"
                        icon={<IconClose />}
                        size="xs"
                        onClick={dismiss}
                      />
                    }
                  >
                    Transaction size limits may cause this dashboard to show partial data.
                    Impact is limited to seer project.
                  </Alert>
                </ModuleLayout.Full>
              )}

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
                    <TracesTable />
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
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <DomainOverviewPageProviders maxPickableDays={datePageFilterProps.maxPickableDays}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <AgentsOverviewPage datePageFilterProps={datePageFilterProps} />
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
  background: ${p => p.theme.tokens.background.primary};
`;

export default PageWithProviders;
