import {useMemo} from 'react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  getAbsoluteSummary,
  getRelativeSummary,
} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import {formatBreakdownLegendValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatBreakdownLegendValue';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useAgentFilter} from 'sentry/views/insights/pages/agents/hooks/useAgentFilter';
import {
  getAgentRunsFilter,
  getAiClientSpansFilter,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {SpanFields} from 'sentry/views/insights/types';

import {AgentsChartsBanner} from './agentsChartsBanner';
import {useAgentsChartsState} from './agentsChartsControls';

const COUNT = `count(${SpanFields.SPAN_DURATION})`;
const COST = `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`;

interface AgentsChart {
  query: string;
  valueType: 'currency' | 'integer';
  widget: Widget;
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
    legendType: 'breakdown',
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
  const estimatedCostQuery = `${getAiClientSpansFilter()}${agentFilterSuffix}`;
  const toolCallsQuery = `${getToolSpansFilter()}${agentFilterSuffix}`;

  const charts = useMemo<AgentsChart[]>(() => {
    const estimatedCostChart: AgentsChart = {
      query: estimatedCostQuery,
      valueType: 'currency',
      widget: createGroupedWidget({
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
    };

    if (hasNoAgentOrToolData) {
      return [estimatedCostChart];
    }

    return [
      estimatedCostChart,
      {
        query: agentRunsQuery,
        valueType: 'integer',
        widget: createGroupedWidget({
          id: 'explore-agents-agent-runs',
          interval: chartInterval,
          title: t('Agent Runs'),
          description: t('Number of agent runs grouped by agent name.'),
          query: agentRunsQuery,
          groupBy: SpanFields.GEN_AI_AGENT_NAME,
          aggregate: COUNT,
          groupByLabel: t('Agent Name'),
          aggregateLabel: t('Runs'),
        }),
      },
      {
        query: toolCallsQuery,
        valueType: 'integer',
        widget: createGroupedWidget({
          id: 'explore-agents-tool-calls',
          interval: chartInterval,
          title: t('Tool Calls'),
          description: t('Number of tool calls grouped by tool name.'),
          query: toolCallsQuery,
          groupBy: SpanFields.GEN_AI_TOOL_NAME,
          aggregate: COUNT,
          groupByLabel: t('Tool Name'),
          aggregateLabel: t('Calls'),
        }),
      },
    ];
  }, [
    agentRunsQuery,
    chartInterval,
    estimatedCostQuery,
    hasNoAgentOrToolData,
    toolCallsQuery,
  ]);

  const widgets = useMemo(() => charts.map(chart => chart.widget), [charts]);

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
        <AgentsChartsBanner show={showMissingAgentDataBanner} />
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
            {charts.map(({widget, query, valueType}) => (
              <Container key={widget.id} minHeight="320px" minWidth="0">
                <AgentsChartCard
                  query={query}
                  valueType={valueType}
                  disableFullscreen
                  disableTableActions
                  disableZoom
                  dashboardFilters={dashboard.filters}
                  selection={selection}
                  showContextMenu
                  onContextMenuAction={key => {
                    const saveType = getSaveType(key);
                    if (saveType && widget.id) {
                      trackAnalytics('conversations.save_as', {
                        organization,
                        chart: widget.id,
                        save_type: saveType,
                      });
                    }
                  }}
                  widget={widget}
                  widgetInterval={chartInterval}
                  widgetLegendState={widgetLegendState}
                />
              </Container>
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}

interface AgentsChartCardProps extends Omit<
  React.ComponentProps<typeof WidgetCard>,
  'titleSummary' | 'widgetLimitReached'
> {
  query: string;
  valueType: AgentsChart['valueType'];
}

function AgentsChartCard({query, valueType, ...widgetCardProps}: AgentsChartCardProps) {
  const aggregate = widgetCardProps.widget.queries[0]?.aggregates[0] ?? COUNT;
  const totalResult = useSpans(
    {
      search: query,
      fields: [aggregate as typeof COUNT],
    },
    Referrer.CHART
  );
  const rawTotal = totalResult.data[0]?.[aggregate as typeof COUNT];
  const total = typeof rawTotal === 'number' ? rawTotal : null;

  const {period, start, end} = widgetCardProps.selection?.datetime ?? {};
  const periodSummary = period
    ? t('Total for %s', getRelativeSummary(period).toLowerCase())
    : start && end
      ? t('Total for %s', getAbsoluteSummary(start, end))
      : t('Total');

  return (
    <WidgetCard
      {...widgetCardProps}
      widgetLimitReached={false}
      titleSummary={
        totalResult.isPending ? undefined : (
          <Tooltip title={periodSummary} skipWrapper>
            <Flex align="baseline" gap="sm">
              <Text size="md" variant="muted" aria-hidden>
                ·
              </Text>
              <Text size="md" bold tabular>
                {formatBreakdownLegendValue(total, valueType)}
              </Text>
            </Flex>
          </Tooltip>
        )
      }
    />
  );
}

function getSaveType(menuKey: string): 'alert' | 'dashboard' | null {
  if (menuKey === 'add-to-dashboard') {
    return 'dashboard';
  }
  if (menuKey.startsWith('create-alert')) {
    return 'alert';
  }
  return null;
}
