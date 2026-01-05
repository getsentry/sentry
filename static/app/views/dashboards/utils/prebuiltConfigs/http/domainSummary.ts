import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  AVERAGE_DURATION_TEXT,
  BASE_FILTERS,
  DASHBOARD_TITLE,
  RESPONSE_CODES_TEXT,
  THROUGHPUT_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SpanFields} from 'sentry/views/insights/types';

const FILTER_STRING = MutableSearch.fromQueryObject(BASE_FILTERS).formatString();

const DOMAIN_WIDGET: Widget = {
  id: 'domain-widget',
  title: t('Domain'),
  displayType: DisplayType.DETAILS,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.ID,
        SpanFields.SPAN_OP,
        SpanFields.SPAN_GROUP,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.SPAN_CATEGORY,
      ] satisfies DefaultDetailWidgetFields[],
      aggregates: [],
      columns: [
        SpanFields.ID,
        SpanFields.SPAN_OP,
        SpanFields.SPAN_GROUP,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.SPAN_CATEGORY,
      ] satisfies DefaultDetailWidgetFields[],
      fieldAliases: [],
      conditions: FILTER_STRING,
      orderby: SpanFields.ID,
      onDemand: [],
      linkedDashboards: [],
    },
  ],
  layout: {
    x: 0,
    y: 0,
    minH: 1,
    h: 1,
    w: 6,
  },
};

const BIG_NUMBER_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'throughput-big-number',
      title: THROUGHPUT_TEXT,
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: THROUGHPUT_TEXT,
          conditions: FILTER_STRING,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          orderby: 'epm()',
        },
      ],
    },
    {
      id: 'duration-big-number',
      title: AVERAGE_DURATION_TEXT,
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          conditions: FILTER_STRING,
          fields: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
    {
      id: '3xx-count-big-number',
      title: t('3XX'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: t('3XX'),
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=300 tags[http.response.status_code,number]:<=399`,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: '4xx-count-big-number',
      title: t('4XX'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: t('4XX'),
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=400 tags[http.response.status_code,number]:<=499`,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: '5xx-count-big-number',
      title: t('5XX'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: t('5XX'),
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=500 tags[http.response.status_code,number]:<=599`,
          fields: [`count(${SpanFields.SPAN_DURATION})`],
          aggregates: [`count(${SpanFields.SPAN_DURATION})`],
          columns: [],
          orderby: `count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'time-spent-big-number',
      title: DataTitles.timeSpent,
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: DataTitles.timeSpent,
          conditions: FILTER_STRING,
          fields: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          orderby: `sum(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
  ],
  1,
  {h: 1, minH: 1}
);

const CHART_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'throughput-chart',
      title: THROUGHPUT_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: THROUGHPUT_TEXT,
          conditions: FILTER_STRING,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          orderby: 'epm()',
        },
      ],
    },
    {
      id: 'duration-chart',
      title: AVERAGE_DURATION_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          conditions: FILTER_STRING,
          fields: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
    {
      id: 'response-codes-chart',
      title: RESPONSE_CODES_TEXT,
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '3XX',
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=300 tags[http.response.status_code,number]:<=399`,
          fields: ['count(span.duration)'],
          aggregates: ['count(span.duration)'],
          columns: [],
          orderby: 'count(span.duration)',
        },
        {
          name: '4XX',
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=400 tags[http.response.status_code,number]:<=499`,
          fields: ['count(span.duration)'],
          aggregates: ['count(span.duration)'],
          columns: [],
          orderby: 'count(span.duration)',
        },
        {
          name: '5XX',
          conditions: `${FILTER_STRING} tags[http.response.status_code,number]:>=500 tags[http.response.status_code,number]:<=599`,
          fields: ['count(span.duration)'],
          aggregates: ['count(span.duration)'],
          columns: [],
          orderby: 'count(span.duration)',
        },
      ],
    },
  ],
  2
);

const TRANSACTIONS_TABLE: Widget = {
  id: 'transactions-table',
  title: t('Transactions making requests to this domain'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      aggregates: [
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fields: [
        SpanFields.TRANSACTION,
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      fieldAliases: [
        t('Found In'),
        THROUGHPUT_TEXT,
        DataTitles.avg,
        DataTitles.timeSpent,
      ],
      conditions: FILTER_STRING,
      name: '',
      orderby: '-sum(span.self_time)',
    },
  ],
  layout: {
    x: 0,
    y: 4,
    minH: 2,
    h: 5,
    w: 6,
  },
};

export const HTTP_DOMAIN_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.SPAN_DOMAIN,
          name: SpanFields.SPAN_DOMAIN,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [
    DOMAIN_WIDGET,
    ...BIG_NUMBER_ROW_WIDGETS,
    ...CHART_ROW_WIDGETS,
    TRANSACTIONS_TABLE,
  ],
};
