import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const MCP_PROMPT_FILTER = `${SpanFields.SPAN_OP}:mcp.server has:${SpanFields.MCP_PROMPT_NAME}`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'mcp-prompts-most-used-prompts',
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
          fieldAliases: [t('Prompt'), t('Calls')],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-prompts-slowest-prompts',
      title: t('Slowest Prompts'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_PROMPT_FILTER,
          fields: [SpanFields.MCP_PROMPT_NAME, `avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.MCP_PROMPT_NAME],
          fieldAliases: [t('Prompt'), t('Avg Duration')],
          orderby: `-avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'mcp-prompts-most-failing-prompts',
      title: t('Most Failing Prompts'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: MCP_PROMPT_FILTER,
          fields: [SpanFields.MCP_PROMPT_NAME, `${SpanFunction.FAILURE_RATE}()`],
          aggregates: [`${SpanFunction.FAILURE_RATE}()`],
          columns: [SpanFields.MCP_PROMPT_NAME],
          fieldAliases: [t('Prompt'), t('Error Rate')],
          orderby: `-${SpanFunction.FAILURE_RATE}()`,
        },
      ],
      limit: 3,
    },
  ],
  0,
  {h: 3, minH: 3}
);

const PROMPTS_TABLE = {
  id: 'mcp-prompts-table',
  title: t('Prompts'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: MCP_PROMPT_FILTER,
      fields: [
        SpanFields.MCP_PROMPT_NAME,
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
      columns: [SpanFields.MCP_PROMPT_NAME],
      fieldAliases: [
        t('Prompt Name'),
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

export const MCP_PROMPTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'MCP Prompts',
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, PROMPTS_TABLE],
};
