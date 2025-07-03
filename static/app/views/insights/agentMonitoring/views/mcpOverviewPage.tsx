import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {AiModuleToggleButton} from 'sentry/views/insights/agentMonitoring/components/aiModuleToggleButton';
import {
  TableType,
  useActiveTable,
} from 'sentry/views/insights/agentMonitoring/hooks/useActiveTable';
import {useLocationSyncedState} from 'sentry/views/insights/agentMonitoring/hooks/useLocationSyncedState';
import {AIInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {Onboarding} from 'sentry/views/insights/agentMonitoring/views/onboarding';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';
import {ModuleName} from 'sentry/views/insights/types';

// MCP-specific imports (these would be the new components we're creating)
import MCPConnectionsWidget from '../components/mcpConnectionsWidget';
import MCPResourceUsageWidget from '../components/mcpResourceUsageWidget';
import MCPToolInvocationsWidget from '../components/mcpToolInvocationsWidget';
import {MCPResourcesTable} from '../components/mcpResourcesTable';
import {MCPServersTable} from '../components/mcpServersTable';
import {MCPToolsTable} from '../components/mcpToolsTable';

const TableControl = SegmentedControl<TableType>;
const TableControlItem = SegmentedControl.Item<TableType>;

// Extended table types for MCP
export enum MCPTableType {
  SERVERS = 'servers',
  RESOURCES = 'resources',
  TOOLS = 'tools',
}

// Title for MCP page
export const MCP_LANDING_TITLE = t('MCP Instrumentation');

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  // Check if any projects have MCP instrumentation enabled
  // This would need to be added to the project model
  return !selectedProjects.some(p => p.hasInsightsMcpMonitoring);
}

function MCPMonitoringPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  const [searchQuery, setSearchQuery] = useLocationSyncedState('query', decodeScalar);

  const {activeTable, onActiveTableChange} = useActiveTable();

  useEffect(() => {
    trackAnalytics('mcp-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);

  const handleTableSwitch = useCallback(
    (newTable: TableType) => {
      trackAnalytics('mcp-monitoring.table-switch', {
        organization,
        newTable,
        previousTable: activeTable,
      });
      onActiveTableChange(newTable);
    },
    [organization, activeTable, onActiveTableChange]
  );

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
      },
      searchSource: 'mcp-monitoring',
      numberTags,
      stringTags,
      replaceRawSearchKeys: ['span.description'],
    }),
    [searchQuery, numberTags, stringTags, setSearchQuery]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <AgentsPageHeader
        module={ModuleName.AGENTS}
        headerActions={<AiModuleToggleButton />}
        headerTitle={
          <Fragment>
            {MCP_LANDING_TITLE}
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
                    <InsightsProjectSelector />
                    <EnvironmentPageFilter />
                    <DatePageFilter {...datePageFilterProps} />
                  </PageFilterBar>
                  {!showOnboarding && (
                    <QueryBuilderWrapper>
                      <EAPSpanSearchQueryBuilder {...eapSpanSearchQueryBuilderProps} />
                    </QueryBuilderWrapper>
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
                        <OverviewAgentsRunsChartWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <OverviewAgentsDurationChartWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <IssuesWidget />
                      </WidgetGrid.Position3>
                      <WidgetGrid.Position4>
                        <MCPConnectionsWidget />
                      </WidgetGrid.Position4>
                      <WidgetGrid.Position5>
                        <MCPToolInvocationsWidget />
                      </WidgetGrid.Position5>
                      <WidgetGrid.Position6>
                        <MCPResourceUsageWidget />
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
                        <TableControlItem key={MCPTableType.SERVERS}>
                          {t('MCP Servers')}
                        </TableControlItem>
                        <TableControlItem key={MCPTableType.RESOURCES}>
                          {t('Resources')}
                        </TableControlItem>
                        <TableControlItem key={MCPTableType.TOOLS}>
                          {t('MCP Tools')}
                        </TableControlItem>
                      </TableControl>
                    </ControlsWrapper>
                    {activeTable === TableType.TRACES && <div>Traces Table (reuse existing)</div>}
                    {activeTable === MCPTableType.SERVERS && <MCPServersTable />}
                    {activeTable === MCPTableType.RESOURCES && <MCPResourcesTable />}
                    {activeTable === MCPTableType.TOOLS && <MCPToolsTable />}
                  </Fragment>
                )}
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  return (
    <AIInsightsFeature>
      <ModulePageProviders
        moduleName={ModuleName.AGENTS}
        analyticEventName="insight.page_loads.mcp"
      >
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <MCPMonitoringPage />
        </TraceItemAttributeProvider>
      </ModulePageProviders>
    </AIInsightsFeature>
  );
}

const QueryBuilderWrapper = styled('div')`
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
