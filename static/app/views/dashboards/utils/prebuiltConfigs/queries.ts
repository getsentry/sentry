import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {EXCLUDED_DB_OPS} from 'sentry/views/insights/database/settings';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const BASE_FILTERS = {
  [SpanFields.SPAN_CATEGORY]: ModuleName.DB,
  [`!${SpanFields.SPAN_OP}`]: `[${EXCLUDED_DB_OPS.join(',')}]`,
  has: SpanFields.NORMALIZED_DESCRIPTION,
};

const FILTER_STRING = MutableSearch.fromQueryObject(BASE_FILTERS).formatString();

export const QUERIES_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: 'Backend Queries',
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'span.system',
          name: 'span.system',
          kind: FieldKind.TAG,
        },
        value: 'span.system:postgresql',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'span.action',
          name: 'span.action',
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'span.domain',
          name: 'span.domain',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  widgets: [
    {
      id: 'throughput',
      title: t('Queries Per Minute'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '',
      queries: [
        {
          name: '',
          conditions: FILTER_STRING,
          fields: ['epm()'],
          aggregates: ['epm()'],
          columns: [],
          orderby: 'epm()',
        },
      ],
      layout: {
        y: 0,
        w: 3,
        h: 2,
        x: 0,
        minH: 2,
      },
    },
    {
      id: 'duration',
      title: t('Average Duration'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '',
      queries: [
        {
          name: '',
          conditions: FILTER_STRING,
          fields: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
      layout: {
        y: 0,
        w: 3,
        h: 2,
        x: 3,
        minH: 2,
      },
    },
    {
      id: 'queries-table',
      title: t('Queries List'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '',
      queries: [
        {
          name: '',
          conditions: FILTER_STRING,
          fields: [
            SpanFields.NORMALIZED_DESCRIPTION,
            'epm()',
            `avg(${SpanFields.SPAN_SELF_TIME})`,
            `sum(${SpanFields.SPAN_SELF_TIME})`,
          ],
          aggregates: [
            'epm()',
            `avg(${SpanFields.SPAN_SELF_TIME})`,
            `sum(${SpanFields.SPAN_SELF_TIME})`,
          ],
          columns: [SpanFields.NORMALIZED_DESCRIPTION],
          orderby: `sum(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
      layout: {
        y: 2,
        w: 6,
        h: 6,
        x: 0,
        minH: 2,
      },
    },
  ],
};
