import React, {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {AiModuleToggleButton} from 'sentry/views/insights/agentMonitoring/components/aiModuleToggleButton';
import {LegacyLLMMonitoringInfoAlert} from 'sentry/views/insights/agentMonitoring/components/legacyLlmMonitoringAlert';
import LLMGenerationsWidget from 'sentry/views/insights/agentMonitoring/components/llmGenerationsWidget';
import {ModelsTable} from 'sentry/views/insights/agentMonitoring/components/modelsTable';
import TokenUsageWidget from 'sentry/views/insights/agentMonitoring/components/tokenUsageWidget';
import {ToolsTable} from 'sentry/views/insights/agentMonitoring/components/toolsTable';
import ToolUsageWidget from 'sentry/views/insights/agentMonitoring/components/toolUsageWidget';
import {TracesTable} from 'sentry/views/insights/agentMonitoring/components/tracesTable';
import {
  TableType,
  useActiveTable,
} from 'sentry/views/insights/agentMonitoring/hooks/useActiveTable';
import {
  AIInsightsFeature,
  usePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';
import {Onboarding} from 'sentry/views/insights/agentMonitoring/views/onboarding';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {AGENTS_LANDING_TITLE} from 'sentry/views/insights/pages/agents/settings';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

const TableControl = SegmentedControl<TableType>;
const TableControlItem = SegmentedControl.Item<TableType>;

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  return !selectedProjects.some(p => p.hasInsightsAgentMonitoring);
}

function useShouldShowLegacyLLMAlert() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  const hasAgentMonitoring = selectedProjects.some(p => p.hasInsightsAgentMonitoring);
  const hasLlmMonitoring = selectedProjects.some(p => p.hasInsightsLlmMonitoring);

  return hasLlmMonitoring && !hasAgentMonitoring;
}

function AgentsMonitoringPage() {
  const location = useLocation();
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const hasInsightsLlmMonitoring = useShouldShowLegacyLLMAlert();
  const datePageFilterProps = limitMaxPickableDays(organization);

  const {eventView, handleSearch} = useTransactionNameQuery();
  const searchBarQuery = getTransactionSearchQuery(location, eventView.query);

  const {activeTable, onActiveTableChange} = useActiveTable();

  useEffect(() => {
    trackAnalytics('agent-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);

  const handleTableSwitch = useCallback(
    (newTable: TableType) => {
      trackAnalytics('agent-monitoring.table-switch', {
        organization,
        newTable,
        previousTable: activeTable,
      });
      onActiveTableChange(newTable);
    },
    [organization, activeTable, onActiveTableChange]
  );

  return (
    <React.Fragment>
      <AgentsPageHeader
        module={ModuleName.AGENTS}
        headerActions={<AiModuleToggleButton />}
        headerTitle={
          <Fragment>
            {AGENTS_LANDING_TITLE}
            <FeatureBadge type="beta" />
          </Fragment>
        }
      />
      <ModuleBodyUpsellHook moduleName={ModuleName.AGENTS}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <ProjectPageFilter resetParamsOnChange={['starred']} />
                    <EnvironmentPageFilter />
                    <DatePageFilter {...datePageFilterProps} />
                  </PageFilterBar>
                  {!showOnboarding && (
                    <StyledTransactionNameSearchBar
                      organization={organization}
                      eventView={eventView}
                      onSearch={handleSearch}
                      query={searchBarQuery}
                    />
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                {hasInsightsLlmMonitoring && <LegacyLLMMonitoringInfoAlert />}
                {showOnboarding ? (
                  <Onboarding />
                ) : (
                  <Fragment>
                    <WidgetGrid>
                      <WidgetGrid.Position1>
                        <OverviewAgentsRunsChartWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <OverviewAgentsDurationChartWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <IssuesWidget />
                      </WidgetGrid.Position3>
                      <WidgetGrid.Position4>
                        <LLMGenerationsWidget />
                      </WidgetGrid.Position4>
                      <WidgetGrid.Position5>
                        <ToolUsageWidget />
                      </WidgetGrid.Position5>
                      <WidgetGrid.Position6>
                        <TokenUsageWidget />
                      </WidgetGrid.Position6>
                    </WidgetGrid>
                    <ControlsWrapper>
                      <TableControl
                        value={activeTable}
                        onChange={handleTableSwitch}
                        size="sm"
                      >
                        <TableControlItem key={TableType.TRACES}>
                          {t('Traces')}
                        </TableControlItem>
                        <TableControlItem key={TableType.MODELS}>
                          {t('Models')}
                        </TableControlItem>
                        <TableControlItem key={TableType.TOOLS}>
                          {t('Tools')}
                        </TableControlItem>
                      </TableControl>
                    </ControlsWrapper>
                    {activeTable === TableType.TRACES && <TracesTable />}
                    {activeTable === TableType.MODELS && <ModelsTable />}
                    {activeTable === TableType.TOOLS && <ToolsTable />}
                  </Fragment>
                )}
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </React.Fragment>
  );
}

function PageWithProviders() {
  const preferedAiModule = usePreferedAiModule();

  if (preferedAiModule === 'llm-monitoring') {
    return (
      <Redirect
        to={`/${INSIGHTS_BASE_URL}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
      />
    );
  }

  return (
    <AIInsightsFeature>
      <ModulePageProviders
        moduleName={ModuleName.AGENTS}
        analyticEventName="insight.page_loads.agents"
      >
        <AgentsMonitoringPage />
      </ModulePageProviders>
    </AIInsightsFeature>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;

const ControlsWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  margin: ${space(2)} 0;
`;

export default PageWithProviders;
