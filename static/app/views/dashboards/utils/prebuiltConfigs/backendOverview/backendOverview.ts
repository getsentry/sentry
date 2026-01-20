import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/backendOverview/settings';
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
      id: 'requests-widget',
      title: 'Requests',
      description: '',
      displayType: DisplayType.LINE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: 'Requests',
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
          conditions: `${SpanFields.SPAN_OP}:http.server`,
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 5,
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'api-latency-widget',
      title: t('Api Latency'),
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
          conditions: `${SpanFields.SPAN_OP}:http.server`,
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'recommended-issues-widget',
      title: 'Recommended Issues',
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
      id: 'jobs-chart',
      title: 'Jobs',
      description: '',
      displayType: DisplayType.LINE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldMeta: [null, {valueType: 'percentage', valueUnit: null}],
          fieldAliases: [],
          conditions: `${SpanFields.SPAN_OP}:queue.process`,
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 3,
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'queries-by-time-spent-chart',
      title: t('Queries by Time Spent'),
      description: '',
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [
            SpanFields.NORMALIZED_DESCRIPTION,
            `p75(${SpanFields.SPAN_SELF_TIME})`,
          ],
          aggregates: [`p75(${SpanFields.SPAN_SELF_TIME})`],
          columns: [SpanFields.NORMALIZED_DESCRIPTION],
          fieldAliases: [''],
          conditions: `${SpanFields.DB_SYSTEM}:[${Object.values(SupportedDatabaseSystem).join(',')}]`,
          orderby: `-p75(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
      limit: 3,
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'cache-miss-rates-chart',
      title: 'Cache Miss Rates',
      description: '',
      displayType: DisplayType.LINE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: [
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [SpanFields.TRANSACTION],
          fieldMeta: [{valueType: 'percentage', valueUnit: null}],
          fieldAliases: [''],
          conditions: `${SpanFields.SPAN_OP}:[cache.get,cache.get_item]`,
          orderby: `-equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 4,
      widgetType: WidgetType.SPANS,
    },
  ],
  2
);

const THIRD_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'jobs-table',
      title: 'Jobs',
      description: '',
      displayType: DisplayType.TABLE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.TRACE_STATUS},equals,internal_error) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldMeta: [null, {valueType: 'percentage', valueUnit: null}],
          fieldAliases: ['Jobs', 'Error Rate'],
          conditions: `${SpanFields.SPAN_OP}:queue.process`,
          orderby: `-count(${SpanFields.SPAN_DURATION})`,
        },
      ],
      limit: 4,
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'queries-by-time-spent-table',
      title: 'Queries by Time Spent',
      description: '',
      displayType: DisplayType.TABLE,
      interval: '1h',
      tableWidths: [-1, -1],
      queries: [
        {
          name: '',
          fields: [
            SpanFields.NORMALIZED_DESCRIPTION,
            `sum(${SpanFields.SPAN_SELF_TIME})`,
          ],
          columns: [SpanFields.NORMALIZED_DESCRIPTION],
          fieldAliases: ['Query Description', 'Time Spent'],
          aggregates: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          conditions: `${SpanFields.DB_SYSTEM}:[${Object.values(SupportedDatabaseSystem).join(',')}]`,
          orderby: `-sum(${SpanFields.SPAN_SELF_TIME})`,
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.NORMALIZED_DESCRIPTION,
              staticDashboardId: 3,
            },
          ],
        },
      ],
      widgetType: WidgetType.SPANS,
      limit: 3,
    },
    {
      id: 'cache-miss-rates-table',
      title: 'Cache Miss Rates',
      description: '',
      displayType: DisplayType.TABLE,
      thresholds: null,
      interval: '1h',
      tableWidths: [-1, -1, -1, -1],
      queries: [
        {
          name: '',
          fields: [
            SpanFields.TRANSACTION,
            'equation|count_if(cache.hit,equals,false)',
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            'equation|count_if(cache.hit,equals,false)',
            `count(${SpanFields.SPAN_DURATION})`,
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [SpanFields.TRANSACTION],
          fieldMeta: [null, null, null, {valueType: 'percentage', valueUnit: null}],
          fieldAliases: ['', 'Cache Misses', 'Cache Calls', 'Cache Miss Rate'],
          conditions: `${SpanFields.SPAN_OP}:[cache.get,cache.get_item]`,
          orderby: '-equation[1]',
        },
      ],
      widgetType: WidgetType.SPANS,
    },
  ],
  4
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
        SpanFields.REQUEST_METHOD,
        SpanFields.TRANSACTION,
        SpanFields.SPAN_OP,
        SpanFields.PROJECT,
      ],
      fieldAliases: [
        'Http Method',
        '',
        'Operation',
        '',
        'TPM',
        'P50()',
        'P95()',
        'Failure rate',
        'Users',
        'Time Spent',
      ],
      fieldMeta: [
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

export const BACKEND_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
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
    ...THIRD_ROW_WIDGETS,
    TRANSACTIONS_TABLE,
  ],
};
