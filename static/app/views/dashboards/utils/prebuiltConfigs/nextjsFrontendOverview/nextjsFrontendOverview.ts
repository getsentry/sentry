import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/nextjsFrontendOverview/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_ALLOWED_OPS} from 'sentry/views/insights/pages/backend/settings';
import {WEB_VITALS_OPS} from 'sentry/views/insights/pages/frontend/settings';
import {SpanFields} from 'sentry/views/insights/types';

const CLIENT_QUERY = new MutableSearch('');
CLIENT_QUERY.addFilterValue(
  'span.op',
  `[${[...WEB_VITALS_OPS, 'navigation', 'default'].join(',')}]`
);
CLIENT_QUERY.addFilterValues('!span.op', BACKEND_OVERVIEW_PAGE_ALLOWED_OPS);
CLIENT_QUERY.addFilterValue(SpanFields.IS_TRANSACTION, 'true');
CLIENT_QUERY.addFilterValues(
  `!${SpanFields.SENTRY_ORIGIN}`,
  ['auto.db.*', 'auto'],
  false
);

const SERVER_QUERY = new MutableSearch('');
SERVER_QUERY.addFilterValue(SpanFields.SPAN_OP, 'http.server');
SERVER_QUERY.addFilterValue(SpanFields.IS_TRANSACTION, 'true');

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'pageloads-widget',
      title: t('Pageloads'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: `${SpanFields.SPAN_OP}:pageload`,
          aggregates: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fields: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          fieldMeta: [null, {valueType: 'percentage', valueUnit: null}],
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'api-latency-widget',
      title: t('API Latency'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: `${SpanFields.SPAN_OP}:http.server`,
          aggregates: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
          fields: [
            `avg(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
        },
      ],
    },
    {
      id: 'issue-counts',
      title: t('Issue Counts'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count(new_issues)', 'count(resolved_issues)'],
          aggregates: ['count(new_issues)', 'count(resolved_issues)'],
          columns: [],
          orderby: '',
        },
      ],
    },
  ],
  0
);

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'score-breakdown-wheel',
      title: t('Performance Score'),
      displayType: DisplayType.WHEEL,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: DEFAULT_QUERY_FILTER,
          fields: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.inp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.total)',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
          ],
          aggregates: [],
          columns: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.inp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.total)',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
          ],
          orderby: '',
        },
      ],
    },
    {
      id: 'slow-ssr-widget',
      title: t('Slow SSR'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      legendType: 'breakdown',
      interval: '5m',
      limit: 4,
      queries: [
        {
          name: '',
          conditions: `${SpanFields.SPAN_OP}:function.nextjs`,
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [SpanFields.SPAN_DESCRIPTION],
          fields: [SpanFields.SPAN_DESCRIPTION, `avg(${SpanFields.SPAN_DURATION})`],
          orderby: `-avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
  ],
  2,
  {h: 3, minH: 3}
);

const CLIENT_TRANSACTIONS_TABLE_FIELDS = [
  SpanFields.TRANSACTION,
  SpanFields.PROJECT,
  SpanFields.SPAN_OP,
  `count(${SpanFields.SPAN_DURATION})`,
  'failure_rate()',
  `avg(${SpanFields.SPAN_DURATION})`,
  `p95(${SpanFields.SPAN_DURATION})`,
  `performance_score(${SpanFields.TOTAL_SCORE})`,
];

const CLIENT_TRANSACTIONS_TABLE: Widget = {
  id: 'client-transactions-table',
  title: t('Client Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  tableWidths: CLIENT_TRANSACTIONS_TABLE_FIELDS.map(() => -1),
  queries: [
    {
      name: '',
      conditions: CLIENT_QUERY.formatString(),
      aggregates: [
        `count(${SpanFields.SPAN_DURATION})`,
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `performance_score(${SpanFields.TOTAL_SCORE})`,
      ],
      columns: [SpanFields.TRANSACTION, SpanFields.SPAN_OP, SpanFields.PROJECT],
      fields: CLIENT_TRANSACTIONS_TABLE_FIELDS,
      fieldAliases: [
        t('Transaction'),
        '',
        t('Operation'),
        t('Views'),
        t('Error Rate'),
        t('Avg Duration'),
        t('P95 Duration'),
        t('Perf Score'),
      ],
      orderby: `-count(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 5,
    w: 6,
    h: 2,
    minH: 2,
  },
};

const SERVER_TRANSACTIONS_TABLE_FIELDS = [
  SpanFields.TRANSACTION,
  SpanFields.PROJECT,
  `count(${SpanFields.SPAN_DURATION})`,
  'failure_rate()',
  `avg(${SpanFields.SPAN_DURATION})`,
  `p95(${SpanFields.SPAN_DURATION})`,
  `sum(${SpanFields.SPAN_DURATION})`,
];

const SERVER_TRANSACTIONS_TABLE: Widget = {
  id: 'server-transactions-table',
  title: t('Server Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  tableWidths: SERVER_TRANSACTIONS_TABLE_FIELDS.map(() => -1),
  queries: [
    {
      name: '',
      conditions: SERVER_QUERY.formatString(),
      aggregates: [
        `count(${SpanFields.SPAN_DURATION})`,
        'failure_rate()',
        `avg(${SpanFields.SPAN_DURATION})`,
        `p95(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION, SpanFields.PROJECT],
      fields: SERVER_TRANSACTIONS_TABLE_FIELDS,
      fieldAliases: [
        t('Transaction'),
        '',
        t('Views'),
        t('Error Rate'),
        t('Avg Duration'),
        t('P95 Duration'),
        t('Time Spent'),
      ],
      orderby: `-count(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 7,
    w: 6,
    h: 2,
    minH: 2,
  },
};

export const NEXTJS_FRONTEND_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
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
  widgets: [
    ...FIRST_ROW_WIDGETS,
    ...SECOND_ROW_WIDGETS,
    CLIENT_TRANSACTIONS_TABLE,
    SERVER_TRANSACTIONS_TABLE,
  ],
};
