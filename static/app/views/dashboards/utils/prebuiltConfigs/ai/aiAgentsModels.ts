import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const AI_GENERATIONS_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'ai-agents-model-cost',
      title: t('Model Cost'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: AI_GENERATIONS_FILTER,
          fields: [
            SpanFields.GEN_AI_REQUEST_MODEL,
            `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
          ],
          aggregates: [`sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`],
          columns: [SpanFields.GEN_AI_REQUEST_MODEL],
          fieldAliases: [t('Model'), t('Total Cost')],
          orderby: `-sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
        },
      ],
      limit: 3,
    },
    {
      id: 'ai-agents-token-usage',
      title: t('Tokens Used'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: AI_GENERATIONS_FILTER,
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
      id: 'ai-agents-token-types',
      title: t('Token Types'),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      legendType: 'breakdown',
      queries: [
        {
          name: '',
          conditions: AI_GENERATIONS_FILTER,
          fields: [
            `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
            `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})`,
            `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`,
            `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})`,
          ],
          aggregates: [
            `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
            `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})`,
            `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`,
            `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})`,
          ],
          columns: [],
          fieldAliases: [
            t('Input Tokens'),
            t('Cached Input Tokens'),
            t('Output Tokens'),
            t('Reasoning Tokens'),
          ],
          orderby: `-sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
        },
      ],
    },
  ],
  0,
  {h: 3, minH: 3}
);

const MODELS_TABLE = {
  id: 'ai-agents-models-table',
  title: t('Models'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      conditions: AI_GENERATIONS_FILTER,
      fields: [
        SpanFields.GEN_AI_REQUEST_MODEL,
        'count()',
        'count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})`,
      ],
      aggregates: [
        'count()',
        'count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})`,
      ],
      columns: [SpanFields.GEN_AI_REQUEST_MODEL],
      fieldAliases: [
        t('Model'),
        t('Requests'),
        t('Errors'),
        t('Avg'),
        t('P95'),
        t('Input Tokens'),
        t('Cached Tokens'),
        t('Output Tokens'),
        t('Reasoning Tokens'),
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

export const AI_AGENTS_MODELS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'AI Agents Models',
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, MODELS_TABLE],
};
