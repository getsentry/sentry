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
import Redirect from 'sentry/components/redirect';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {AiModuleToggleButton} from 'sentry/views/insights/agentMonitoring/components/aiModuleToggleButton';
import {LegacyLLMMonitoringInfoAlert} from 'sentry/views/insights/agentMonitoring/components/legacyLlmMonitoringAlert';
import LLMGenerationsWidget from 'sentry/views/insights/agentMonitoring/components/llmGenerationsWidget';
import {ModelsTable} from 'sentry/views/insights/agentMonitoring/components/modelsTable';
import TokenThroughputWidget from 'sentry/views/insights/agentMonitoring/components/tokenThroughputWidget';
import TokenUsageWidget from 'sentry/views/insights/agentMonitoring/components/tokenUsageWidget';
import {ToolsTable} from 'sentry/views/insights/agentMonitoring/components/toolsTable';
import ToolUsageWidget from 'sentry/views/insights/agentMonitoring/components/toolUsageWidget';
import {TracesTable} from 'sentry/views/insights/agentMonitoring/components/tracesTable';
import {
  TableType,
  useActiveTable,
} from 'sentry/views/insights/agentMonitoring/hooks/useActiveTable';
import {useLocationSyncedState} from 'sentry/views/insights/agentMonitoring/hooks/useLocationSyncedState';
import {
  AIInsightsFeature,
  usePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';
import {Onboarding} from 'sentry/views/insights/agentMonitoring/views/onboarding';
import {WidgetGrid} from 'sentry/views/insights/agentMonitoring/views/styles';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import OverviewAgentsDurationChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget';
import OverviewAgentsRunsChartWidget from 'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {AGENTS_LANDING_TITLE} from 'sentry/views/insights/pages/agents/settings';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
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
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const hasInsightsLlmMonitoring = useShouldShowLegacyLLMAlert();
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

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
      },
      searchSource: 'agent-monitoring',
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
                        <TokenThroughputWidget />
                      </WidgetGrid.Position3>
                      <WidgetGrid.Position4>
                        <LLMGenerationsWidget />
                      </WidgetGrid.Position4>
                      <WidgetGrid.Position5>
                        <TokenUsageWidget />
                      </WidgetGrid.Position5>
                      <WidgetGrid.Position6>
                        <TokenCostsWidget />
                      </WidgetGrid.Position6>
                      <WidgetGrid.Position7>
                        <ToolUsageWidget />
                      </WidgetGrid.Position7>
                      <WidgetGrid.Position8>
                        <ToolErrorsWidget />
                      </WidgetGrid.Position8>
                      <WidgetGrid.Position9>
                        <TokensPerToolWidget />
                      </WidgetGrid.Position9>
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
    </SearchQueryBuilderProvider>
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <AgentsMonitoringPage />
        </TraceItemAttributeProvider>
      </ModulePageProviders>
    </AIInsightsFeature>
  );
}

function PlaceholderText() {
  return <PlaceholderContent>{t('Placeholder')}</PlaceholderContent>;
}

export function ToolErrorsWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Tool errors')} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function TokenCostsWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Token costs')} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function TokensPerToolWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Tokens per tool')} />}
      Visualization={<PlaceholderText />}
    />
  );
}
const PlaceholderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

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
