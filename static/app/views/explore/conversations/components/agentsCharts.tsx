import {useMemo} from 'react';

import {Container, Grid} from '@sentry/scraps/layout';

import {
  FORTY_EIGHT_HOURS,
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  ONE_WEEK,
  SIX_HOURS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
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
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {
  getAgentRunsFilter,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {SpanFields} from 'sentry/views/insights/types';

const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;
const COUNT = `count(${SpanFields.SPAN_DURATION})`;
const COST = `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`;

const AGENT_CHART_INTERVALS = new GranularityLadder([
  [ONE_WEEK, '1d'],
  [FORTY_EIGHT_HOURS, '6h'],
  [TWENTY_FOUR_HOURS, '1h'],
  [SIX_HOURS, '30m'],
  [ONE_HOUR, '5m'],
  [0, '1m'],
]);

export function getAgentChartInterval(datetime: PageFilterDatetime): string {
  return AGENT_CHART_INTERVALS.getInterval(getDiffInMinutes(datetime));
}

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
  const chartInterval = getAgentChartInterval(selection.datetime);

  const agentRunsQuery = useCombinedQuery(getAgentRunsFilter());
  const estimatedCostQuery = useCombinedQuery(AI_CLIENT_FILTER);
  const toolCallsQuery = useCombinedQuery(getToolSpansFilter());

  const widgets = useMemo<Widget[]>(
    () => [
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
        id: 'explore-agents-estimated-cost',
        interval: chartInterval,
        title: t('Estimated Cost'),
        description: t('Estimated cost of LLM calls grouped by response model.'),
        query: estimatedCostQuery,
        groupBy: SpanFields.GEN_AI_RESPONSE_MODEL,
        aggregate: COST,
        groupByLabel: t('Model'),
        aggregateLabel: t('Estimated Cost'),
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
    ],
    [agentRunsQuery, chartInterval, estimatedCostQuery, toolCallsQuery]
  );

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
      <Grid columns={{zero: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))'}} gap="md">
        {widgets.map(widget => (
          <Container key={widget.id} minHeight="240px" minWidth="0">
            <DashboardsMEPProvider>
              <WidgetCard
                disableFullscreen
                disableTableActions
                disableZoom
                dashboardFilters={dashboard.filters}
                selection={selection}
                showContextMenu={false}
                widget={widget}
                widgetInterval={chartInterval}
                widgetLegendState={widgetLegendState}
                widgetLimitReached={false}
              />
            </DashboardsMEPProvider>
          </Container>
        ))}
      </Grid>
    </Container>
  );
}
