import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {OVERVIEW_PAGE_ALLOWED_OPS} from 'sentry/views/insights/pages/backend/settings';
import {
  OVERVIEW_PAGE_ALLOWED_OPS as FRONTEND_OVERVIEW_PAGE_OPS,
  WEB_VITALS_OPS,
} from 'sentry/views/insights/pages/frontend/settings';
import {OVERVIEW_PAGE_ALLOWED_OPS as MOBILE_OVERVIEW_PAGE_OPS} from 'sentry/views/insights/pages/mobile/settings';
import {SpanFields} from 'sentry/views/insights/types';

const disallowedOps = [
  ...new Set([
    ...FRONTEND_OVERVIEW_PAGE_OPS,
    ...MOBILE_OVERVIEW_PAGE_OPS,
    ...WEB_VITALS_OPS,
  ]),
];

const TABLE_QUERY = new MutableSearch('');
TABLE_QUERY.addOp('(');
TABLE_QUERY.addFilterValues('!span.op', disallowedOps);
TABLE_QUERY.addOp(')');
TABLE_QUERY.addOp('OR');
TABLE_QUERY.addDisjunctionFilterValues('span.op', OVERVIEW_PAGE_ALLOWED_OPS);

const FIRST_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'traffic-widget',
      title: 'Traffic',
      description: '',
      displayType: DisplayType.LINE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: 'Runs',
          fields: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          fieldMeta: [null, {valueType: 'percentage', valueUnit: null}],
          columns: [],
          fieldAliases: [],
          conditions: 'gen_ai.operation.type:agent',
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 5,
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'duration-widget',
      title: t('Duration'),
      description: '',
      displayType: DisplayType.LINE,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldAliases: [],
          conditions: `gen_ai.operation.type:agent`,
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'issues-widget',
      title: 'Issues',
      displayType: DisplayType.TABLE,
      interval: '1h',
      tableWidths: [-1, -1],
      queries: [
        {
          name: '',
          fields: ['title', 'lastSeen'],
          aggregates: [],
          columns: ['title', 'lastSeen'],
          fieldAliases: ['', ''],
          conditions: 'is:unresolved event.type:error',
          orderby: 'freq',
          onDemand: [],
          isHidden: false,
          linkedDashboards: [],
        },
      ],
      widgetType: WidgetType.ISSUE,
    },
  ],
  0
);

const SECOND_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'llm-calls-widget',
      title: 'LLM Calls',
      description: '',
      displayType: DisplayType.BAR,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: ['gen_ai.request.model', `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: ['gen_ai.request.model'],
          fieldAliases: [],
          conditions: '(gen_ai.operation.type:ai_client)',
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'llm-tokens-used-widget',
      title: 'Tokens Used',
      description: '',
      displayType: DisplayType.BAR,
      thresholds: null,
      interval: '15m',
      queries: [
        {
          name: '',
          fields: ['gen_ai.request.model', `sum(gen_ai.usage.total_tokens)`],
          aggregates: [`sum(gen_ai.usage.total_tokens)`],
          columns: ['gen_ai.request.model'],
          fieldAliases: [],
          conditions: 'gen_ai.operation.type:ai_client',
          orderby: `-sum(gen_ai.usage.total_tokens)`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'llm-tools-called',
      title: 'Tools Called',
      description: '',
      displayType: DisplayType.BAR,
      thresholds: null,
      interval: '15m',
      queries: [
        {
          name: '',
          fields: ['gen_ai.tool.name', `count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: ['gen_ai.tool.name'],
          fieldAliases: [],
          conditions: 'gen_ai.operation.type:tool',
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
  ],
  2
);

const TRANSACTIONS_TABLE: Widget = {
  id: 'backend-overview-transactions-table',
  title: 'Transactions',
  description: '',
  displayType: DisplayType.TABLE,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.IS_STARRED_TRANSACTION,
        SpanFields.REQUEST_METHOD,
        SpanFields.TRANSACTION,
        SpanFields.SPAN_OP,
        SpanFields.PROJECT,
        'epm()',
        `p50(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `equation|failure_count() / count(${SpanFields.SPAN_DURATION})`,
        `count_unique(${SpanFields.USER})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        'epm()',
        `p50(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `equation|failure_count() / count(${SpanFields.SPAN_DURATION})`,
        `count_unique(${SpanFields.USER})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [
        SpanFields.IS_STARRED_TRANSACTION,
        SpanFields.REQUEST_METHOD,
        SpanFields.TRANSACTION,
        SpanFields.SPAN_OP,
        SpanFields.PROJECT,
      ],
      fieldAliases: [
        t('Starred'),
        'Http Method',
        t('Transaction'),
        t('Operation'),
        t('Project'),
        t('TPM'),
        'P50()',
        'P95()',
        t('Failure rate'),
        t('Users'),
        t('Time Spent'),
      ],
      fieldMeta: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        {valueType: 'percentage', valueUnit: null},
      ],
      conditions: TABLE_QUERY.formatString(),
      orderby: '-sum(span.duration)',
      linkedDashboards: [],
    },
  ],
  widgetType: WidgetType.SPANS,
  layout: {
    x: 0,
    w: 6,
    h: 6,
    minH: 2,
    y: 6,
  },
};

export const AGENTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.TRANSACTION,
          name: SpanFields.TRANSACTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [...FIRST_ROW_WIDGETS, ...SECOND_ROW_WIDGETS, TRANSACTIONS_TABLE],
};
