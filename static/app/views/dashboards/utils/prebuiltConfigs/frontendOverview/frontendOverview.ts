import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  DASHBOARD_TITLE,
  FRONTEND_SDK_NAMES,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendOverview/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {getResourcesEventViewQuery} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_ALLOWED_OPS} from 'sentry/views/insights/pages/backend/settings';
import {
  OVERVIEW_PAGE_ALLOWED_OPS as FRONTEND_OVERVIEW_PAGE_OPS,
  WEB_VITALS_OPS,
} from 'sentry/views/insights/pages/frontend/settings';
import {SpanFields} from 'sentry/views/insights/types';

const BASE_QUERY = new MutableSearch('');
BASE_QUERY.addFilterValues('!span.op', BACKEND_OVERVIEW_PAGE_ALLOWED_OPS);
BASE_QUERY.addFilterValue('span.op', `[${FRONTEND_OVERVIEW_PAGE_OPS.join(',')}]`);
BASE_QUERY.addFilterValue(SpanFields.IS_TRANSACTION, 'true');

const TABLE_QUERY = new MutableSearch('');
TABLE_QUERY.addOp('(');
TABLE_QUERY.addFilterValues('!span.op', BACKEND_OVERVIEW_PAGE_ALLOWED_OPS);
TABLE_QUERY.addFilterValue(
  'span.op',
  `[${[...FRONTEND_OVERVIEW_PAGE_OPS, ...WEB_VITALS_OPS].join(',')}]`
);
TABLE_QUERY.addOp('OR');
TABLE_QUERY.addFilterValue('sdk.name', `[${FRONTEND_SDK_NAMES.join(',')}]`);
TABLE_QUERY.addOp(')');
TABLE_QUERY.addFilterValue(SpanFields.IS_TRANSACTION, 'true');

const ASSETS_BY_TIME_SPENT_QUERY = getResourcesEventViewQuery(
  {},
  DEFAULT_RESOURCE_TYPES
).join(' ');
const assetsByTimeSpentQuery = new MutableSearch(
  `has:${SpanFields.NORMALIZED_DESCRIPTION} ${ASSETS_BY_TIME_SPENT_QUERY}`
);

const FIRST_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'throughput-widget',
      title: t('Throughput'),
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [`epm()`],
          aggregates: [`epm()`],
          columns: [],
          fieldAliases: [],
          conditions: BASE_QUERY.formatString(),
          orderby: `-epm()`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
    {
      id: 'duration-widget',
      title: t('Duration'),
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: [
            `p50(${SpanFields.SPAN_DURATION})`,
            `p75(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            `p50(${SpanFields.SPAN_DURATION})`,
            `p75(${SpanFields.SPAN_DURATION})`,
            `p95(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fieldAliases: [],
          conditions: BASE_QUERY.formatString(),
          orderby: `-p50(${SpanFields.SPAN_DURATION})`,
        },
      ],
      widgetType: WidgetType.SPANS,
    },
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
  ],
  0
);

const SECOND_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
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
    {
      id: 'assets-by-time-spent-widget',
      title: t('Assets by Time Spent'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      legendType: 'breakdown',
      limit: 3,
      queries: [
        {
          name: '',
          conditions: assetsByTimeSpentQuery.formatString(),
          fields: ['p75(span.duration)'],
          aggregates: ['p75(span.duration)'],
          columns: [SpanFields.NORMALIZED_DESCRIPTION],
          orderby: `-sum(span.duration)`,
        },
      ],
    },
    {
      id: 'network-requests-by-time-spent-widget',
      title: t('Network Requests by Time Spent'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      legendType: 'breakdown',
      limit: 3,
      queries: [
        {
          name: '',
          conditions: `${SpanFields.SPAN_CATEGORY}:http`,
          fields: ['p75(span.duration)'],
          aggregates: ['p75(span.duration)'],
          columns: [SpanFields.SPAN_DOMAIN],
          orderby: `-sum(span.duration)`,
        },
      ],
    },
  ],
  2,
  {h: 3, minH: 3}
);

const TRANSACTIONS_TABLE: Widget = {
  id: 'frontend-overview-table',
  title: t('Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  limit: 50,
  queries: [
    {
      name: '',
      conditions: TABLE_QUERY.formatString(),
      aggregates: [
        'tpm()',
        `p50_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `p75_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `p95_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `failure_rate_if(${SpanFields.IS_TRANSACTION},equals,true)`,
        `count_unique(${SpanFields.USER})`,
        `sum_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `performance_score(measurements.score.total)`,
      ],
      fields: [
        SpanFields.IS_STARRED_TRANSACTION,
        SpanFields.TRANSACTION,
        SpanFields.PROJECT,
        'tpm()',
        `p50_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `p75_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `p95_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `failure_rate_if(${SpanFields.IS_TRANSACTION},equals,true)`,
        `count_unique(${SpanFields.USER})`,
        `sum_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
        `performance_score(measurements.score.total)`,
      ],
      fieldAliases: [
        t('Starred'),
        t('Transaction'),
        t('Project'),
        t('TPM'),
        t('p50()'),
        t('p75()'),
        t('p95()'),
        t('Failure Rate'),
        t('Users'),
        t('Time Spent'),
        t('Performance Score'),
      ],
      columns: [
        SpanFields.IS_STARRED_TRANSACTION,
        SpanFields.TRANSACTION,
        SpanFields.PROJECT,
      ],
      orderby: `-sum_if(${SpanFields.SPAN_DURATION},${SpanFields.IS_TRANSACTION},equals,true)`,
    },
  ],
  layout: {
    x: 0,
    y: 7,
    w: 6,
    h: 6,
    minH: 2,
  },
};

export const FRONTEND_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
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
