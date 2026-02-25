import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {SpanFields} from 'sentry/views/insights/types';

const FILTER_QUERY = MutableSearch.fromQueryObject({
  has: SpanFields.NORMALIZED_DESCRIPTION,
});

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'requests-per-min-widget',
      title: t('Requests per Minute'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: ['epm()'],
          columns: [],
          conditions: FILTER_QUERY.formatString(),
          orderby: 'epm()',
        },
      ],
    },
    {
      id: 'average-duration-widget',
      title: t('Average Duration'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          conditions: FILTER_QUERY.formatString(),
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
  ],
  0,
  {h: 2, minH: 2}
);

const ASSETS_TABLE: Widget = {
  id: 'assets-table',
  title: t('Assets'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: FILTER_QUERY.formatString(),
      aggregates: [
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
      ],
      columns: [SpanFields.NORMALIZED_DESCRIPTION],
      fields: [
        SpanFields.NORMALIZED_DESCRIPTION,
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
      ],
      fieldAliases: [
        t('Asset description'),
        t('Requests per Minute'),
        t('Avg Duration'),
        t('Time Spent'),
        t('Avg Encoded Size'),
      ],
      orderby: `-sum(${SpanFields.SPAN_SELF_TIME})`,
      linkedDashboards: [
        {
          dashboardId: '-1',
          field: SpanFields.NORMALIZED_DESCRIPTION,
          staticDashboardId: 25,
        },
      ],
    },
  ],
  layout: {
    x: 0,
    y: 2,
    w: 6,
    h: 6,
    minH: 2,
  },
};

export const FRONTEND_ASSETS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
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
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.RESOURCE_RENDER_BLOCKING_STATUS,
          name: SpanFields.RESOURCE_RENDER_BLOCKING_STATUS,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.TRANSACTION,
          name: SpanFields.TRANSACTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.SPAN_OP,
          name: SpanFields.SPAN_OP,
          kind: FieldKind.TAG,
        },
        value: `${SpanFields.SPAN_OP}:[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.FILE_EXTENSION,
          name: SpanFields.FILE_EXTENSION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  title: DASHBOARD_TITLE,
  widgets: [...FIRST_ROW_WIDGETS, ASSETS_TABLE],
};
