import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
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
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {McpInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {
  GroupedDurationWidget,
  GroupedErrorRateWidget,
  GroupedTrafficWidget,
  McpTrafficWidget,
  PromptsTable,
  RequestsBySourceWidget,
  ResourcesTable,
  ToolsTable,
  TransportDistributionWidget,
} from 'sentry/views/insights/mcp/components/placeholders';
import {WidgetGrid} from 'sentry/views/insights/mcp/components/styles';
import {MODULE_TITLE} from 'sentry/views/insights/mcp/settings';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

const TableControl = SegmentedControl<ViewType>;
const TableControlItem = SegmentedControl.Item<ViewType>;

enum ViewType {
  TOOL = 'tool',
  RESOURCE = 'resource',
  PROMPT = 'prompt',
}

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  return !selectedProjects.some(p => p.hasInsightsMCP);
}

function McpOverviewPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTable, setActiveTable] = useState<ViewType>(ViewType.TOOL);

  useEffect(() => {}, [organization, showOnboarding]);

  const handleTableSwitch = useCallback((newTable: ViewType) => {
    setActiveTable(newTable);
  }, []);

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
        module={ModuleName.MCP}
        headerTitle={
          <Fragment>
            {MODULE_TITLE}
            <FeatureBadge type="beta" />
          </Fragment>
        }
      />
      <ModuleBodyUpsellHook moduleName={ModuleName.MCP}>
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
                  <ModulesOnboardingPanel moduleName={ModuleName.MCP} />
                ) : (
                  <Fragment>
                    <WidgetGrid>
                      <WidgetGrid.Position1>
                        <McpTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <RequestsBySourceWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <TransportDistributionWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <ControlsWrapper>
                      <TableControl
                        value={activeTable}
                        onChange={handleTableSwitch}
                        size="sm"
                      >
                        <TableControlItem key={ViewType.TOOL}>
                          {t('Tools')}
                        </TableControlItem>
                        <TableControlItem key={ViewType.RESOURCE}>
                          {t('Resources')}
                        </TableControlItem>
                        <TableControlItem key={ViewType.PROMPT}>
                          {t('Prompts')}
                        </TableControlItem>
                      </TableControl>
                    </ControlsWrapper>
                    <WidgetGrid>
                      <WidgetGrid.Position1>
                        <GroupedTrafficWidget groupBy={activeTable} />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <GroupedDurationWidget groupBy={activeTable} />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <GroupedErrorRateWidget groupBy={activeTable} />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    {activeTable === ViewType.TOOL && <ToolsTable />}
                    {activeTable === ViewType.RESOURCE && <ResourcesTable />}
                    {activeTable === ViewType.PROMPT && <PromptsTable />}
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
    <McpInsightsFeature>
      <ModulePageProviders moduleName={ModuleName.MCP}>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <McpOverviewPage />
        </TraceItemAttributeProvider>
      </ModulePageProviders>
    </McpInsightsFeature>
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
