import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, MAX_TABLE_LIMIT, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  WIDGET_COLUMN_LABELS,
  TABLE_MIN_HEIGHT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const AGENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:agent`;
const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;
const AGENT_AND_AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:[agent, ai_client]`;
const TOOL_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:tool`;

const DEFAULT_GLOBAL_FILTERS = [
  {
    dataset: WidgetType.SPANS,
    tag: {
      key: 'gen_ai.agent.name',
      name: 'gen_ai.agent.name',
      kind: FieldKind.TAG,
    },
    value: '',
  },
];

export const DEFAULT_TRACES_TABLE_WIDTHS = [
  110,
  COL_WIDTH_UNDEFINED,
  140,
  110,
  110,
  110,
  120,
  110,
  110,
];

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'ai-agents-overview-agent-runs',
      title: t('Agent Runs'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      queries: [
        {
          name: t('Count'),
          conditions: AGENT_FILTER,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          fieldAliases: [WIDGET_COLUMN_LABELS.count],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'ai-agents-overview-llm-calls-traffic',
      title: t('LLM Calls'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      queries: [
        {
          name: t('Count'),
          conditions: AI_CLIENT_FILTER,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          fieldAliases: [WIDGET_COLUMN_LABELS.count],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'ai-agents-overview-duration',
      title: t('Duration'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      queries: [
        {
          name: '',
          conditions: AGENT_AND_AI_CLIENT_FILTER,
          fields: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldAliases: [WIDGET_COLUMN_LABELS.avg, WIDGET_COLUMN_LABELS.p95],
          orderby: `-avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
  ],
  0
);

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'ai-agents-overview-llm-calls-by-model',
      title: t('LLM Calls by Model'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: AI_CLIENT_FILTER,
          fields: [SpanFields.GEN_AI_REQUEST_MODEL, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.GEN_AI_REQUEST_MODEL],
          fieldAliases: [WIDGET_COLUMN_LABELS.model, WIDGET_COLUMN_LABELS.calls],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.GEN_AI_REQUEST_MODEL,
              staticDashboardId: 17,
            },
          ],
        },
      ],
      limit: 3,
    },
    {
      id: 'ai-agents-overview-tokens-used',
      title: t('Tokens Used'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: AI_CLIENT_FILTER,
          fields: [
            SpanFields.GEN_AI_REQUEST_MODEL,
            `sum(${SpanFields.GEN_AI_USAGE_TOTAL_TOKENS})`,
          ],
          aggregates: [`sum(${SpanFields.GEN_AI_USAGE_TOTAL_TOKENS})`],
          columns: [SpanFields.GEN_AI_REQUEST_MODEL],
          fieldAliases: [WIDGET_COLUMN_LABELS.model, t('Total Tokens')],
          orderby: `-sum(${SpanFields.GEN_AI_USAGE_TOTAL_TOKENS})`,
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.GEN_AI_REQUEST_MODEL,
              staticDashboardId: 17,
            },
          ],
        },
      ],
      limit: 3,
    },
    {
      id: 'ai-agents-overview-tool-calls',
      title: t('Tool Calls'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: TOOL_FILTER,
          fields: [SpanFields.GEN_AI_TOOL_NAME, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.GEN_AI_TOOL_NAME],
          fieldAliases: [WIDGET_COLUMN_LABELS.tool, WIDGET_COLUMN_LABELS.calls],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.GEN_AI_TOOL_NAME,
              staticDashboardId: 18,
            },
          ],
        },
      ],
      limit: 3,
    },
  ],
  2,
  {h: 3, minH: 3}
);

const AGENTS_TRACES_TABLE = {
  id: 'ai-agents-traces-table',
  title: t('Traces'),
  displayType: DisplayType.AGENTS_TRACES_TABLE,
  interval: '1h',
  tableWidths: DEFAULT_TRACES_TABLE_WIDTHS,
  limit: MAX_TABLE_LIMIT,
  queries: [
    {
      conditions: '',
      fields: [],
      columns: [],
      aggregates: [],
      name: '',
      orderby: '',
    },
  ],
  layout: {
    x: 0,
    y: 6,
    w: 6,
    h: 4,
    minH: TABLE_MIN_HEIGHT,
  },
};

export const AI_AGENTS_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'AI Agents Overview',
  filters: {
    globalFilter: DEFAULT_GLOBAL_FILTERS,
  },
  widgets: [...FIRST_ROW_WIDGETS, ...SECOND_ROW_WIDGETS, AGENTS_TRACES_TABLE],
  onboarding: {
    type: 'custom',
    componentId: 'agent-monitoring',
    requiredProjectFlags: ['hasInsightsAgentMonitoring'],
  },
};
