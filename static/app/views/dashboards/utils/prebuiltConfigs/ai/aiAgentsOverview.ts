import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const AGENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:agent`;
const AI_CLIENT_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;
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

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'ai-agents-overview-runs',
      title: t('Runs'),
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
          fieldAliases: [t('Count')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'ai-agents-overview-error-rate',
      title: t('Error Rate'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      queries: [
        {
          name: t('Error Rate'),
          conditions: AGENT_FILTER,
          fields: [`${SpanFunction.TRACE_STATUS_RATE}(internal_error)`],
          aggregates: [`${SpanFunction.TRACE_STATUS_RATE}(internal_error)`],
          columns: [],
          fieldAliases: [t('Error Rate')],
          orderby: `-${SpanFunction.TRACE_STATUS_RATE}(internal_error)`,
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
          conditions: AGENT_FILTER,
          fields: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldAliases: [t('Avg Duration'), t('P95 Duration')],
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
      id: 'ai-agents-overview-llm-calls',
      title: t('LLM Calls'),
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
          fieldAliases: [t('Model'), t('Calls')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
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
          fieldAliases: [t('Model'), t('Total Tokens')],
          orderby: `-sum(${SpanFields.GEN_AI_USAGE_TOTAL_TOKENS})`,
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
          fieldAliases: [t('Tool'), t('Calls')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
  ],
  2,
  {h: 3, minH: 3}
);

export const AI_AGENTS_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'AI Agents Overview',
  filters: {
    globalFilter: DEFAULT_GLOBAL_FILTERS,
  },
  widgets: [...FIRST_ROW_WIDGETS, ...SECOND_ROW_WIDGETS],
};
