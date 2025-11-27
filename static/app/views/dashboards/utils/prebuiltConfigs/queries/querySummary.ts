import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  AVERAGE_DURATION_TEXT,
  QUERIES_PER_MINUTE_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/constants';
import {SpanFields} from 'sentry/views/insights/types';

export const QUERIES_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'Backend Queries',
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
          conditions: '',
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {w: 2, h: 1, x: 2, y: 0, minH: 1},
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
          conditions: '',
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {w: 2, h: 1, x: 0, y: 0, minH: 1},
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
          conditions: '',
          orderby: '',
          isHidden: false,
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {w: 2, h: 1, x: 4, y: 0, minH: 1},
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
          conditions: '',
          orderby: `-sum(${SpanFields.SPAN_SELF_TIME})`,
          onDemand: [],
          isHidden: false,
          linkedDashboards: [],
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {w: 6, h: 2, x: 0, y: 3, minH: 2},
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
          conditions: '',
          orderby: 'epm()',
          onDemand: [],
          isHidden: false,
          linkedDashboards: [],
        },
      ],
      widgetType: WidgetType.SPANS,
      layout: {w: 3, h: 2, x: 0, y: 1, minH: 2},
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
          conditions: '',
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
          onDemand: [],
          isHidden: false,
        },
      ],
      layout: {w: 3, h: 2, x: 3, y: 1, minH: 2},
    },
  ],
};
