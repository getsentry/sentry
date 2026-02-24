import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const MCP_SERVER_FILTER = `${SpanFields.SPAN_OP}:mcp.server`;
const MCP_TOOL_FILTER = `${MCP_SERVER_FILTER} has:${SpanFields.MCP_TOOL_NAME}`;
const MCP_RESOURCE_FILTER = `${MCP_SERVER_FILTER} has:${SpanFields.MCP_RESOURCE_URI}`;
const MCP_PROMPT_FILTER = `${MCP_SERVER_FILTER} has:${SpanFields.MCP_PROMPT_NAME}`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'mcp-overview-traffic',
      title: t('Traffic'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      queries: [
        {
          name: t('Count'),
          conditions: MCP_SERVER_FILTER,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          fieldAliases: [t('Count')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'mcp-overview-traffic-by-client',
      title: t('Traffic by Client'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_SERVER_FILTER,
          fields: [SpanFields.MCP_CLIENT_NAME, 'count()'],
          aggregates: ['count()'],
          columns: [SpanFields.MCP_CLIENT_NAME],
          fieldAliases: [t('Client'), t('Count')],
          orderby: '-count()',
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-overview-transport-distribution',
      title: t('Transport Distribution'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: `${MCP_SERVER_FILTER} has:${SpanFields.MCP_TRANSPORT}`,
          fields: [SpanFields.MCP_TRANSPORT, 'count()'],
          aggregates: ['count()'],
          columns: [SpanFields.MCP_TRANSPORT],
          fieldAliases: [t('Transport'), t('Count')],
          orderby: '-count()',
        },
      ],
      limit: 3,
    },
  ],
  0
);

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'mcp-overview-most-used-tools',
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
          fieldAliases: [t('Tool'), t('Count')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-overview-most-used-resources',
      title: t('Most Used Resources'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_RESOURCE_FILTER,
          fields: [SpanFields.MCP_RESOURCE_URI, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_RESOURCE_URI],
          fieldAliases: [t('Resource'), t('Count')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-overview-most-used-prompts',
      title: t('Most Used Prompts'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_PROMPT_FILTER,
          fields: [SpanFields.MCP_PROMPT_NAME, `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_PROMPT_NAME],
          fieldAliases: [t('Prompt'), t('Count')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
  ],
  2,
  {h: 3, minH: 3}
);

const OVERVIEW_TABLE = {
  id: 'mcp-overview-table',
  title: t('MCP Overview'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: MCP_SERVER_FILTER,
      fields: [
        SpanFields.SPAN_DESCRIPTION,
        'count()',
        `${SpanFunction.FAILURE_RATE}()`,
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        'count()',
        `${SpanFunction.FAILURE_RATE}()`,
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.SPAN_DESCRIPTION],
      fieldAliases: [
        t('Span Description'),
        t('Requests'),
        t('Error Rate'),
        t('Avg'),
        t('P95'),
      ],
      orderby: '-count()',
    },
  ],
  layout: {
    x: 0,
    y: 5,
    w: 6,
    h: 4,
    minH: 2,
  },
};

export const MCP_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'MCP Overview',
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, ...SECOND_ROW_WIDGETS, OVERVIEW_TABLE],
};
