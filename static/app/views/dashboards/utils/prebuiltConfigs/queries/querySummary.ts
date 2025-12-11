import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  AVERAGE_DURATION_TEXT,
  QUERIES_PER_MINUTE_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/constants';
import {BASE_FILTERS} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/queries';
import {SpanFields} from 'sentry/views/insights/types';

const FILTER_STRING = MutableSearch.fromQueryObject(BASE_FILTERS).formatString();

export const QUERIES_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'Query Details',
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.NORMALIZED_DESCRIPTION,
          name: SpanFields.NORMALIZED_DESCRIPTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [
    {
      id: 'metrics-throughput',
      title: QUERIES_PER_MINUTE_TEXT,
      description: '',
      displayType: DisplayType.BIG_NUMBER,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: QUERIES_PER_MINUTE_TEXT,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          conditions: FILTER_STRING,
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {y: 0, x: 2, h: 1, w: 2, minH: 1},
    },
    {
      id: 'metrics-duration',
      title: AVERAGE_DURATION_TEXT,
      description: '',
      displayType: DisplayType.BIG_NUMBER,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          fields: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          conditions: FILTER_STRING,
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {y: 0, x: 0, h: 1, w: 2, minH: 1},
    },
    {
      id: 'metrics-time-spent',
      title: 'Time Spent',
      description: '',
      displayType: DisplayType.BIG_NUMBER,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          conditions: FILTER_STRING,
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {y: 0, x: 4, h: 1, w: 2, minH: 1},
    },
    {
      id: 'example-query',
      title: 'Example Query',
      description: '',
      displayType: DisplayType.DETAILS,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: ['id', 'span.op', 'span.group', 'span.description', 'span.category'],
          aggregates: [],
          columns: ['id', 'span.op', 'span.group', 'span.description', 'span.category'],
          fieldAliases: [],
          conditions: FILTER_STRING,
          orderby: 'id',
          onDemand: [],
          linkedDashboards: [],
        },
      ],
      limit: 1,
      widgetType: WidgetType.SPANS,
      layout: {y: 1, x: 0, h: 2, w: 6, minH: 2},
    },
    {
      id: 'transactions-with-query',
      title: 'Transactions with query',
      description: '',
      displayType: DisplayType.TABLE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: '',
          fields: ['transaction', 'epm()', `sum(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: ['epm()', `sum(${SpanFields.SPAN_SELF_TIME})`],
          columns: [SpanFields.TRANSACTION],
          fieldAliases: [t('Found In'), t('Queries Per Minute'), t('Time Spent')],
          conditions: FILTER_STRING,
          orderby: `-sum(${SpanFields.SPAN_SELF_TIME})`,
          onDemand: [],
          isHidden: false,
          linkedDashboards: [],
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {y: 5, x: 0, h: 2, w: 6, minH: 2},
    },
    {
      id: 'metrics-throughput-line',
      title: 'Queries Per Minute',
      description: '',
      displayType: DisplayType.LINE,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: QUERIES_PER_MINUTE_TEXT,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          fieldAliases: [],
          conditions: FILTER_STRING,
          orderby: 'epm()',
          onDemand: [],
          isHidden: false,
          linkedDashboards: [],
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {y: 3, x: 0, h: 2, w: 3, minH: 2},
    },
    {
      id: 'metrics-duration-line',
      title: 'Average Duration',
      description: '',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      thresholds: null,
      interval: '1h',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          fields: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          fieldAliases: [],
          conditions: FILTER_STRING,
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
          onDemand: [],
          isHidden: false,
        },
      ],
      layout: {y: 3, x: 3, h: 2, w: 3, minH: 2},
    },
  ],
};
