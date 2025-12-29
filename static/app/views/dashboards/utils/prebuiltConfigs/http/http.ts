import {t} from 'sentry/locale';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  AVERAGE_DURATION_TEXT,
  BASE_FILTERS,
  DASHBOARD_TITLE,
  RESPONSE_CODES_TEXT,
  THROUGHPUT_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SpanFields} from 'sentry/views/insights/types';

const FILTER_STRING = MutableSearch.fromQueryObject(BASE_FILTERS).formatString();

const FIRST_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
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
  0
);

const DOMAIN_TABLE: Widget = {
  id: 'domain-table',
  title: t('Domains'),
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
      columns: [SpanFields.SPAN_DOMAIN, SpanFields.PROJECT],
      fields: [
        SpanFields.SPAN_DOMAIN,
        SpanFields.PROJECT,
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      fieldAliases: [
        t('Domain'),
        t('Project'),
        `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
        DataTitles.avg,
        DataTitles.timeSpent,
      ],
      linkedDashboards: [
        {
          dashboardId: '-1',
          field: SpanFields.SPAN_DOMAIN,
          staticDashboardId: 5,
        },
      ],
      conditions: FILTER_STRING,
      name: '',
      orderby: '-sum(span.self_time)',
    },
  ],
  layout: {
    x: 0,
    y: 2,
    minH: 2,
    h: 4,
    w: 6,
  },
};

export const HTTP_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.USER_GEO_SUBREGION,
          name: SpanFields.USER_GEO_SUBREGION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
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
  widgets: [...FIRST_ROW_WIDGETS, DOMAIN_TABLE],
};
