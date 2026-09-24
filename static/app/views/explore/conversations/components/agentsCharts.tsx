import {useMemo} from 'react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  type DashboardDetails,
  DisplayType,
  type Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import {AgentsChartsBanner} from 'sentry/views/explore/conversations/components/agentsChartsBanner';
import {useAgentsChartsState} from 'sentry/views/explore/conversations/components/agentsChartsControls';
import {useAgentFilter} from 'sentry/views/insights/pages/agents/hooks/useAgentFilter';
import {
  getAgentRunsFilter,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {SpanFields} from 'sentry/views/insights/types';

const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;
const COUNT = `count(${SpanFields.SPAN_DURATION})`;
const COST = `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`;

function createGroupedWidget({
  id,
  title,
  description,
  query,
  groupBy,
  aggregate,
  interval,
  groupByLabel,
  aggregateLabel,
}: {
  aggregate: string;
  aggregateLabel: string;
  description: string;
  groupBy: string;
  groupByLabel: string;
  id: string;
  interval: string;
  query: string;
  title: string;
}): Widget {
  return {
    id,
    title,
    description,
    displayType: DisplayType.BAR,
    widgetType: WidgetType.SPANS,
    interval,
    limit: 3,
    queries: [
      {
        name: '',
        conditions: query,
        fields: [groupBy, aggregate],
        aggregates: [aggregate],
        columns: [groupBy],
        fieldAliases: [groupByLabel, aggregateLabel],
        orderby: `-${aggregate}`,
      },
    ],
  };
}

export function AgentsCharts() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const agentsChartsState = useAgentsChartsState();
  const {
    chartInterval,
    hasNoAgentOrToolData,
    isChartDataPending,
    showMissingAgentDataBanner,
  } = agentsChartsState;
  const {agentQuery} = useAgentFilter();
  const agentFilterSuffix = agentQuery ? ` ${agentQuery}` : '';

  const agentRunsQuery = `${getAgentRunsFilter()}${agentFilterSuffix}`;
  const estimatedCostQuery = `${AI_CLIENT_FILTER}${agentFilterSuffix}`;
  const toolCallsQuery = `${getToolSpansFilter()}${agentFilterSuffix}`;

  const widgets = useMemo<Widget[]>(() => {
    const estimatedCostWidget = createGroupedWidget({
      id: 'explore-agents-estimated-cost',
      interval: chartInterval,
      title: t('Estimated Cost'),
      description: t('Estimated cost of LLM calls grouped by response model.'),
      query: estimatedCostQuery,
      groupBy: SpanFields.GEN_AI_RESPONSE_MODEL,
      aggregate: COST,
      groupByLabel: t('Model'),
      aggregateLabel: t('Estimated Cost'),
    });

    if (hasNoAgentOrToolData) {
      return [estimatedCostWidget];
    }

    return [
      estimatedCostWidget,
      createGroupedWidget({
        id: 'explore-agents-agent-runs',
        interval: chartInterval,
        title: t('Agent runs'),
        description: t('Number of agent runs grouped by agent name.'),
        query: agentRunsQuery,
        groupBy: SpanFields.GEN_AI_AGENT_NAME,
        aggregate: COUNT,
        groupByLabel: t('Agent Name'),
        aggregateLabel: t('Runs'),
      }),
      createGroupedWidget({
        id: 'explore-agents-tool-calls',
        interval: chartInterval,
        title: t('Tool calls'),
        description: t('Number of tool calls grouped by tool name.'),
        query: toolCallsQuery,
        groupBy: SpanFields.GEN_AI_TOOL_NAME,
        aggregate: COUNT,
        groupByLabel: t('Tool Name'),
        aggregateLabel: t('Calls'),
      }),
    ];
  }, [
    agentRunsQuery,
    chartInterval,
    estimatedCostQuery,
    hasNoAgentOrToolData,
    toolCallsQuery,
  ]);

  const dashboard = useMemo<DashboardDetails>(
    () => ({
      id: 'explore-agents',
      title: t('Agents'),
      dateCreated: '',
      filters: {},
      projects: undefined,
      widgets,
    }),
    [widgets]
  );

  const widgetLegendState = useMemo(
    () =>
      new WidgetLegendSelectionState({
        dashboard,
        location,
        navigate,
        organization,
      }),
    [dashboard, location, navigate, organization]
  );

  return (
    <Container containerType="inline-size">
      <Stack gap="sm">
        {isChartDataPending ? (
          <Flex align="center" justify="center" minHeight="240px">
            <LoadingIndicator />
          </Flex>
        ) : (
          <Grid
            columns={
              hasNoAgentOrToolData
                ? 'minmax(0, 1fr)'
                : {zero: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))'}
            }
            gap="md"
          >
            {widgets.map(widget => (
              <Container key={widget.id} minHeight="240px" minWidth="0">
                <WidgetCard
                  disableFullscreen
                  disableTableActions
                  disableZoom
                  dashboardFilters={dashboard.filters}
                  selection={selection}
                  showContextMenu
                  widget={widget}
                  widgetInterval={chartInterval}
                  widgetLegendState={widgetLegendState}
                  widgetLimitReached={false}
                />
              </Container>
            ))}
          </Grid>
        )}
        <AgentsChartsBanner show={showMissingAgentDataBanner} />
      </Stack>
    </Container>
  );
}
