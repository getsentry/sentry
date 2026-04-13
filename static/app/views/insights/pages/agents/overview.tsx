import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {useDismissable} from 'sentry/components/banner';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconClose} from 'sentry/icons';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import OverviewLLMCallsChartWidget from 'sentry/views/insights/common/components/widgets/overviewLLMCallsChartWidget';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {useHasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {IssuesWidget} from 'sentry/views/insights/pages/agents/components/issuesWidget';
import {LLMCallsWidget as LLMCallsByModelWidget} from 'sentry/views/insights/pages/agents/components/llmCallsWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/agents/components/styles';
import {TokenUsageWidget} from 'sentry/views/insights/pages/agents/components/tokenUsageWidget';
import {ToolCallsWidget as ToolUsageWidget} from 'sentry/views/insights/pages/agents/components/toolCallsWidget';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';
import {useAgentMonitoringTrackPageView} from 'sentry/views/insights/pages/agents/hooks/useAgentMonitoringTrackPageView';
import {useAgentSpanSearchProps} from 'sentry/views/insights/pages/agents/hooks/useAgentSpanSearchProps';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {useShowAgentOnboarding} from 'sentry/views/insights/pages/agents/hooks/useShowAgentOnboarding';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {
  TableUrlParams,
  useTraceDrawerQueryState,
} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

interface AgentsOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function AgentsOverviewPage({datePageFilterProps}: AgentsOverviewPageProps) {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();
  const hasPlatformized = useHasPlatformizedInsights();

  if (hasPlatformized) {
    return (
      <PrebuiltDashboardRenderer
        prebuiltId={PrebuiltDashboardId.AI_AGENTS_OVERVIEW}
        storageNamespace={view}
      />
    );
  }

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <AgentsContent datePageFilterProps={datePageFilterProps} />
    </Feature>
  );
}

function AgentsContent({datePageFilterProps}: AgentsOverviewPageProps) {
  const organization = useOrganization();
  const showOnboarding = useShowAgentOnboarding();
  useDefaultToAllProjects();

  const [urlState] = useTraceDrawerQueryState();
  // Start fetching data and open drawer without
  // waiting for table to finish loading
  useAITrace(urlState.traceId ?? '', urlState.timestamp ?? undefined);
  const {openTraceViewDrawer} = useTraceViewDrawer();

  const agentSpanSearchProps = useAgentSpanSearchProps();
  const isSentryEmployee = useIsSentryEmployee();
  const pageFilters = usePageFilters();
  const [dismissed, dismiss] = useDismissable('agents-overview-seer-data-banner');

  const showSeerDataBanner =
    isSentryEmployee && !dismissed && pageFilters.selection.projects.includes(6178942);

  useOverviewPageTrackPageload();
  useAgentMonitoringTrackPageView();

  return (
    <SearchQueryBuilderProvider {...agentSpanSearchProps.provider}>
      <Layout.Body>
        <Layout.Main width="full">
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <InsightsProjectSelector
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                    onChange={() => {
                      trackAnalytics('agent-monitoring.page-filter-change', {
                        organization,
                        filter: 'project',
                      });
                    }}
                  />
                  <InsightsEnvironmentSelector
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                    onChange={() => {
                      trackAnalytics('agent-monitoring.page-filter-change', {
                        organization,
                        filter: 'environment',
                      });
                    }}
                  />
                  <DatePageFilter
                    {...datePageFilterProps}
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                    onChange={() => {
                      trackAnalytics('agent-monitoring.page-filter-change', {
                        organization,
                        filter: 'date',
                      });
                    }}
                  />
                </PageFilterBar>
                <AgentSelector
                  storageKeyPrefix="agents:agent-filter"
                  referrer={Referrer.AGENT_SELECTOR}
                />
                {!showOnboarding && (
                  <Flex flex={2}>
                    <TraceItemSearchQueryBuilder {...agentSpanSearchProps.queryBuilder} />
                  </Flex>
                )}
              </ToolRibbon>
            </ModuleLayout.Full>

            {showSeerDataBanner && (
              <ModuleLayout.Full>
                <Alert
                  variant="warning"
                  trailingItems={
                    <Button
                      aria-label="Dismiss"
                      icon={<IconClose />}
                      size="xs"
                      onClick={dismiss}
                    />
                  }
                >
                  SENTRY EMPLOYEES: Transaction size limits make seer instrumentation
                  incomplete. Data shown here does not reflect actual state.
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
                      <OverviewAgentsRunsChartWidget />
                    </WidgetGrid.Position1>
                    <WidgetGrid.Position2>
                      <OverviewLLMCallsChartWidget />
                    </WidgetGrid.Position2>
                    <WidgetGrid.Position3>
                      <OverviewAgentsDurationChartWidget />
                    </WidgetGrid.Position3>
                  </WidgetGrid>
                  <WidgetGrid rowHeight={260} paddingBottom={0}>
                    <WidgetGrid.Position1>
                      <LLMCallsByModelWidget />
                    </WidgetGrid.Position1>
                    <WidgetGrid.Position2>
                      <TokenUsageWidget />
                    </WidgetGrid.Position2>
                    <WidgetGrid.Position3>
                      <ToolUsageWidget />
                    </WidgetGrid.Position3>
                  </WidgetGrid>
                  <IssuesWidget />
                  <TracesTable openTraceViewDrawer={openTraceViewDrawer} />
                </Stack>
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
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
      <AgentsOverviewPage datePageFilterProps={datePageFilterProps} />
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
