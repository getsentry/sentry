import {t} from 'sentry/locale';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  AVERAGE_DURATION_TEXT,
  BASE_FILTER_STRING,
  DASHBOARD_TITLE,
  QUERIES_PER_MINUTE_TEXT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/settings';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

export const QUERIES_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'span.system',
          name: 'span.system',
          kind: FieldKind.TAG,
        },
        value: '',
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
      interval: '5m',
      queries: [
        {
          name: QUERIES_PER_MINUTE_TEXT,
          conditions: BASE_FILTER_STRING,
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
      interval: '5m',
      queries: [
        {
          name: AVERAGE_DURATION_TEXT,
          conditions: BASE_FILTER_STRING,
          fields: [`avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [],
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
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
      interval: '5m',
      tableWidths: [-1, -1, -1, -1],
      queries: [
        {
          name: '',
          conditions: BASE_FILTER_STRING,
          fields: [
            SpanFields.NORMALIZED_DESCRIPTION,
            'epm()',
            `avg(${SpanFields.SPAN_DURATION})`,
            `sum(${SpanFields.SPAN_DURATION})`,
          ],
          aggregates: [
            'epm()',
            `avg(${SpanFields.SPAN_DURATION})`,
            `sum(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [SpanFields.NORMALIZED_DESCRIPTION],
          orderby: `-sum(${SpanFields.SPAN_DURATION})`,
          fieldAliases: [
            t('Query Description'),
            `${t('Queries')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
            DataTitles.avg,
            DataTitles.timeSpent,
          ],
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.NORMALIZED_DESCRIPTION,
              staticDashboardId: 3,
            },
          ],
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
  onboarding: {type: 'module', moduleName: ModuleName.DB},
};
