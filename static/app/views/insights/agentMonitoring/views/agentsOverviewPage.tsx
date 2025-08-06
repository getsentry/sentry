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
import {IssuesWidget} from 'sentry/views/insights/agentMonitoring/components/issuesWidget';
import LLMGenerationsWidget from 'sentry/views/insights/agentMonitoring/components/llmCallsWidget';
import TokenCostWidget from 'sentry/views/insights/agentMonitoring/components/modelCostWidget';
import {ModelsTable} from 'sentry/views/insights/agentMonitoring/components/modelsTable';
import TokenTypesWidget from 'sentry/views/insights/agentMonitoring/components/tokenTypesWidget';
import TokenUsageWidget from 'sentry/views/insights/agentMonitoring/components/tokenUsageWidget';
import ToolUsageWidget from 'sentry/views/insights/agentMonitoring/components/toolCallsWidget';
import ToolErrorsWidget from 'sentry/views/insights/agentMonitoring/components/toolErrorsWidget';
import {ToolsTable} from 'sentry/views/insights/agentMonitoring/components/toolsTable';
import {TracesTable} from 'sentry/views/insights/agentMonitoring/components/tracesTable';
import {
  TableType,
  useActiveTable,
} from 'sentry/views/insights/agentMonitoring/hooks/useActiveTable';
import {useLocationSyncedState} from 'sentry/views/insights/agentMonitoring/hooks/useLocationSyncedState';
import {AIInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {Onboarding} from 'sentry/views/insights/agentMonitoring/views/onboarding';
import {
  TwoColumnWidgetGrid,
  WidgetGrid,
} from 'sentry/views/insights/agentMonitoring/views/styles';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {getAIModuleTitle} from 'sentry/views/insights/pages/agents/settings';
import {ModuleName} from 'sentry/views/insights/types';

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

function AgentsMonitoringPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  const [searchQuery, setSearchQuery] = useLocationSyncedState('query', decodeScalar);

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

  const {tags: numberTags, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringTags, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );
  const hasMatchKeySuggestions = organization.features.includes(
    'search-query-builder-match-key-suggestions'
  );

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
      },
      searchSource: 'agent-monitoring',
      numberTags,
      stringTags,
      numberSecondaryAliases,
      stringSecondaryAliases,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: hasMatchKeySuggestions
        ? [
            {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
            {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
          ]
        : undefined,
    }),
    [
      hasMatchKeySuggestions,
      hasRawSearchReplacement,
      numberSecondaryAliases,
      numberTags,
      searchQuery,
      setSearchQuery,
      stringSecondaryAliases,
      stringTags,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <AgentsPageHeader
        module={ModuleName.AGENTS}
        headerTitle={
          <Fragment>
            {getAIModuleTitle(organization)}
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
                    <WidgetGrid rowHeight={210} paddingBottom={0}>
                      <WidgetGrid.Position1>
                        <OverviewAgentsRunsChartWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <OverviewAgentsDurationChartWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <IssuesWidget />
                      </WidgetGrid.Position3>
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

                    {activeTable === TableType.TRACES && <TracesView />}
                    {activeTable === TableType.MODELS && <ModelsView />}
                    {activeTable === TableType.TOOLS && <ToolsView />}
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

function TracesView() {
  return (
    <Fragment>
      <WidgetGrid rowHeight={260}>
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
    </Fragment>
  );
}

function ModelsView() {
  return (
    <Fragment>
      <WidgetGrid rowHeight={260}>
        <WidgetGrid.Position1>
          <TokenCostWidget />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <TokenUsageWidget />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <TokenTypesWidget />
        </WidgetGrid.Position3>
      </WidgetGrid>
      <ModelsTable />
    </Fragment>
  );
}

function ToolsView() {
  return (
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
  );
}

function PageWithProviders() {
  return (
    <AIInsightsFeature>
      <ModulePageProviders
        moduleName={ModuleName.AGENTS}
        analyticEventName="insight.page_loads.agents"
      >
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <AgentsMonitoringPage />
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
  gap: ${p => p.theme.space.md};
  margin: ${p => p.theme.space.xl} 0;
`;

export default PageWithProviders;
