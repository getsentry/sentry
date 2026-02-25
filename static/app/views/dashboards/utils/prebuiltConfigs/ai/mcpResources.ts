import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const MCP_RESOURCE_FILTER = `${SpanFields.SPAN_OP}:mcp.server has:${SpanFields.MCP_RESOURCE_URI}`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'mcp-resources-most-used-resources',
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
          fieldAliases: [t('Resource'), t('Calls')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-resources-slowest-resources',
      title: t('Slowest Resources'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_RESOURCE_FILTER,
          fields: [SpanFields.MCP_RESOURCE_URI, `avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_RESOURCE_URI],
          fieldAliases: [t('Resource'), t('Avg Duration')],
          orderby: `-avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-resources-most-failing-resources',
      title: t('Most Failing Resources'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_RESOURCE_FILTER,
          fields: [SpanFields.MCP_RESOURCE_URI, `${SpanFunction.FAILURE_RATE}()`],
          aggregates: [`${SpanFunction.FAILURE_RATE}()`],
          columns: [SpanFields.MCP_RESOURCE_URI],
          fieldAliases: [t('Resource'), t('Error Rate')],
          orderby: `-${SpanFunction.FAILURE_RATE}()`,
        },
      ],
      limit: 3,
    },
  ],
  0,
  {h: 3, minH: 3}
);

const RESOURCES_TABLE = {
  id: 'mcp-resources-table',
  title: t('Resources'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: MCP_RESOURCE_FILTER,
      fields: [
        SpanFields.MCP_RESOURCE_URI,
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
      columns: [SpanFields.MCP_RESOURCE_URI],
      fieldAliases: [
        t('Resource URI'),
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
    y: 3,
    w: 6,
    h: 4,
    minH: 2,
  },
};

export const MCP_RESOURCES_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'MCP Resources',
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, RESOURCES_TABLE],
};
