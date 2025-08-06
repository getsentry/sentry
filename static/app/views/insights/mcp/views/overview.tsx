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
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {useLocationSyncedState} from 'sentry/views/insights/agentMonitoring/hooks/useLocationSyncedState';
import {McpInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import McpTrafficWidget from 'sentry/views/insights/common/components/widgets/mcpTrafficWidget';
import McpPromptDurationWidget from 'sentry/views/insights/mcp/components/mcpPromptDurationWidget';
import McpPromptErrorRateWidget from 'sentry/views/insights/mcp/components/mcpPromptErrorRateWidget';
import {McpPromptsTable} from 'sentry/views/insights/mcp/components/mcpPromptsTable';
import McpPromptTrafficWidget from 'sentry/views/insights/mcp/components/mcpPromptTrafficWidget';
import McpResourceDurationWidget from 'sentry/views/insights/mcp/components/mcpResourceDurationWidget';
import McpResourceErrorRateWidget from 'sentry/views/insights/mcp/components/mcpResourceErrorRateWidget';
import {McpResourcesTable} from 'sentry/views/insights/mcp/components/mcpResourcesTable';
import McpResourceTrafficWidget from 'sentry/views/insights/mcp/components/mcpResourceTrafficWidget';
import McpToolDurationWidget from 'sentry/views/insights/mcp/components/mcpToolDurationWidget';
import McpToolErrorRateWidget from 'sentry/views/insights/mcp/components/mcpToolErrorRateWidget';
import {McpToolsTable} from 'sentry/views/insights/mcp/components/mcpToolsTable';
import McpToolTrafficWidget from 'sentry/views/insights/mcp/components/mcpToolTrafficWidget';
import McpTrafficByClientWidget from 'sentry/views/insights/mcp/components/mcpTrafficByClientWidget';
import McpTransportWidget from 'sentry/views/insights/mcp/components/mcpTransportWidget';
import {WidgetGrid} from 'sentry/views/insights/mcp/components/styles';
import {Onboarding} from 'sentry/views/insights/mcp/views/onboarding';
import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {getAIModuleTitle} from 'sentry/views/insights/pages/agents/settings';
import {ModuleName} from 'sentry/views/insights/types';

const TableControl = SegmentedControl<ViewType>;
const TableControlItem = SegmentedControl.Item<ViewType>;

enum ViewType {
  TOOL = 'tool',
  RESOURCE = 'resource',
  PROMPT = 'prompt',
}

const viewTrafficWidgets: Record<ViewType, React.ComponentType> = {
  [ViewType.TOOL]: McpToolTrafficWidget,
  [ViewType.RESOURCE]: McpResourceTrafficWidget,
  [ViewType.PROMPT]: McpPromptTrafficWidget,
};

const viewDurationWidgets: Record<ViewType, React.ComponentType> = {
  [ViewType.TOOL]: McpToolDurationWidget,
  [ViewType.RESOURCE]: McpResourceDurationWidget,
  [ViewType.PROMPT]: McpPromptDurationWidget,
};

const viewErrorRateWidgets: Record<ViewType, React.ComponentType> = {
  [ViewType.TOOL]: McpToolErrorRateWidget,
  [ViewType.RESOURCE]: McpResourceErrorRateWidget,
  [ViewType.PROMPT]: McpPromptErrorRateWidget,
};

const viewTables: Record<ViewType, React.ComponentType> = {
  [ViewType.TOOL]: McpToolsTable,
  [ViewType.RESOURCE]: McpResourcesTable,
  [ViewType.PROMPT]: McpPromptsTable,
};

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  return !selectedProjects.some(p => p.hasInsightsMCP);
}

function decodeViewType(value: unknown): ViewType | undefined {
  if (Object.values(ViewType).includes(value as ViewType)) {
    return value as ViewType;
  }
  return undefined;
}

function McpOverviewPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const location = useLocation();
  const navigate = useNavigate();
  const datePageFilterProps = limitMaxPickableDays(organization);
  const [searchQuery, setSearchQuery] = useLocationSyncedState('query', decodeScalar);
  const {view} = useLocationQuery({
    fields: {
      view: decodeViewType,
    },
  });
  const activeView = view ?? ViewType.TOOL;

  useEffect(() => {
    trackAnalytics('mcp-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);

  const handleTableSwitch = useCallback(
    (newTable: ViewType) => {
      trackAnalytics('mcp-monitoring.table-switch', {
        organization,
        newTable,
        previousTable: activeView,
      });
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            view: newTable,
            // Clear the tableCursor param when switching tables
            tableCursor: undefined,
          },
        },
        {replace: true}
      );
    },
    [activeView, location, navigate, organization]
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
      searchSource: 'mcp-monitoring',
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

  const ViewTrafficWidget = viewTrafficWidgets[activeView];
  const ViewDurationWidget = viewDurationWidgets[activeView];
  const ViewErrorRateWidget = viewErrorRateWidgets[activeView];
  const ViewTable = viewTables[activeView];

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <AgentsPageHeader
        module={ModuleName.MCP}
        headerTitle={
          <Fragment>
            {getAIModuleTitle(organization)}
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
                    <ControlsWrapper>
                      <TableControl
                        value={activeView}
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
                        <ViewTrafficWidget />
                      </WidgetGrid.Position1>
                      <WidgetGrid.Position2>
                        <ViewDurationWidget />
                      </WidgetGrid.Position2>
                      <WidgetGrid.Position3>
                        <ViewErrorRateWidget />
                      </WidgetGrid.Position3>
                    </WidgetGrid>
                    <ViewTable />
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
  padding-bottom: ${space(2)};
`;

export default PageWithProviders;
