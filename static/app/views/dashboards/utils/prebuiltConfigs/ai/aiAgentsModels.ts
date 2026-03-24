import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {WIDGET_COLUMN_LABELS} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const AI_GENERATIONS_FILTER = `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client`;
// input_tokens includes cached, output_tokens includes reasoning, so total is just the sum of both
const SUM_ALL_TOKENS = `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS}) + sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`;

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
            `equation|(sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS}) - sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})) / (${SUM_ALL_TOKENS})`,
            `equation|sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED}) / (${SUM_ALL_TOKENS})`,
            `equation|(sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS}) - sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})) / (${SUM_ALL_TOKENS})`,
            `equation|sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING}) / (${SUM_ALL_TOKENS})`,
          ],
          aggregates: [
            `equation|(sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS}) - sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})) / (${SUM_ALL_TOKENS})`,
            `equation|sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED}) / (${SUM_ALL_TOKENS})`,
            `equation|(sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS}) - sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})) / (${SUM_ALL_TOKENS})`,
            `equation|sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING}) / (${SUM_ALL_TOKENS})`,
          ],
          columns: [],
          fieldAliases: [
            t('Input Tokens'),
            t('Cached Input Tokens'),
            t('Output Tokens'),
            t('Reasoning Tokens'),
          ],
          orderby: '',
        },
      ],
      limit: 3,
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
        'equation|count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS})`,
        `sum(${SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING})`,
      ],
      aggregates: [
        'count()',
        'equation|count_if(span.status,equals,internal_error)',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.GEN_AI_COST_TOTAL_TOKENS})`,
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
        WIDGET_COLUMN_LABELS.avg,
        WIDGET_COLUMN_LABELS.p95,
        t('Cost'),
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
  title: 'AI Agents Model Details',
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'gen_ai.request.model',
          name: 'gen_ai.request.model',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, MODELS_TABLE],
  onboarding: {
    type: 'custom',
    componentId: 'agent-monitoring',
    requiredProjectFlags: ['hasInsightsAgentMonitoring'],
  },
};
