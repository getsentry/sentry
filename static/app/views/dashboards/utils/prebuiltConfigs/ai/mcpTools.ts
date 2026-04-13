import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {MCP_TOOLS_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/settings';
import {WIDGET_COLUMN_LABELS} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const MCP_TOOL_FILTER = `${SpanFields.SPAN_OP}:mcp.server has:${SpanFields.MCP_TOOL_NAME}`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'mcp-tools-most-used-tools',
      title: t('Most Used Tools'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_TOOL_FILTER,
          fields: [SpanFields.MCP_TOOL_NAME, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_TOOL_NAME],
          fieldAliases: [t('Tool'), t('Calls')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-tools-slowest-tools',
      title: t('Slowest Tools'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_TOOL_FILTER,
          fields: [SpanFields.MCP_TOOL_NAME, `avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_TOOL_NAME],
          fieldAliases: [t('Tool'), WIDGET_COLUMN_LABELS.avg],
          orderby: `-avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-tools-most-failing-tools',
      title: t('Most Failing Tools'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_TOOL_FILTER,
          fields: [SpanFields.MCP_TOOL_NAME, `${SpanFunction.FAILURE_RATE}()`],
          aggregates: [`${SpanFunction.FAILURE_RATE}()`],
          columns: [SpanFields.MCP_TOOL_NAME],
          fieldAliases: [t('Tool'), t('Error Rate')],
          orderby: `-${SpanFunction.FAILURE_RATE}()`,
        },
      ],
      limit: 3,
    },
  ],
  0,
  {h: 3, minH: 3}
);

const TOOLS_TABLE = {
  id: 'mcp-tools-table',
  title: t('Tools'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: MCP_TOOL_FILTER,
      fields: [
        SpanFields.MCP_TOOL_NAME,
        'count()',
        `${SpanFunction.FAILURE_RATE}()`,
        `equation|count_if(${SpanFields.SPAN_STATUS},equals,internal_error)`,
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        'count()',
        `${SpanFunction.FAILURE_RATE}()`,
        `equation|count_if(${SpanFields.SPAN_STATUS},equals,internal_error)`,
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.MCP_TOOL_NAME],
      fieldAliases: [
        t('Tool Name'),
        t('Requests'),
        t('Error Rate'),
        t('Errors'),
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

export const MCP_TOOLS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: MCP_TOOLS_DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'mcp.tool.name',
          name: 'mcp.tool.name',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, TOOLS_TABLE],
  onboarding: {
    type: 'custom',
    componentId: 'mcp',
    requiredProjectFlags: ['hasInsightsMCP'],
  },
};
