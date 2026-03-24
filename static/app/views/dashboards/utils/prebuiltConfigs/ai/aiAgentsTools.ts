import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {WIDGET_COLUMN_LABELS} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const TOOL_SPANS_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:tool`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'ai-agents-tool-calls',
      title: t('Tool Calls'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: TOOL_SPANS_FILTER,
          fields: [SpanFields.GEN_AI_TOOL_NAME, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.GEN_AI_TOOL_NAME],
          fieldAliases: [WIDGET_COLUMN_LABELS.tool, WIDGET_COLUMN_LABELS.calls],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'ai-agents-tool-errors',
      title: t('Tool Errors'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: `${TOOL_SPANS_FILTER} ${SpanFields.SPAN_STATUS}:internal_error`,
          fields: [SpanFields.GEN_AI_TOOL_NAME, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.GEN_AI_TOOL_NAME],
          fieldAliases: [WIDGET_COLUMN_LABELS.tool, WIDGET_COLUMN_LABELS.errors],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
  ],
  0,
  {h: 3, minH: 3}
);

const TOOLS_TABLE = {
  id: 'ai-agents-tools-table',
  title: t('Tools'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: TOOL_SPANS_FILTER,
      fields: [
        SpanFields.GEN_AI_TOOL_NAME,
        'count()',
        'equation|count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        'count()',
        'equation|count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.GEN_AI_TOOL_NAME],
      fieldAliases: [
        WIDGET_COLUMN_LABELS.tool,
        WIDGET_COLUMN_LABELS.requests,
        WIDGET_COLUMN_LABELS.errors,
        WIDGET_COLUMN_LABELS.avg,
        WIDGET_COLUMN_LABELS.p95,
      ],
      orderby: '-count()',
    },
  ],
  layout: {
    x: 0,
    y: 3,
    w: 6,
    h: 4,
    minH: 2,
  },
};

export const AI_AGENTS_TOOLS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'AI Agents Tool Details',
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'gen_ai.tool.name',
          name: 'gen_ai.tool.name',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, TOOLS_TABLE],
  onboarding: {
    type: 'custom',
    componentId: 'agent-monitoring',
    requiredProjectFlags: ['hasInsightsAgentMonitoring'],
  },
};
