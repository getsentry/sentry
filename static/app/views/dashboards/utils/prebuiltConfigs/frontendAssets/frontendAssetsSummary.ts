import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SUMMARY_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {SpanFields} from 'sentry/views/insights/types';

const ASSET_DESCRIPTION_WIDGET: Widget = {
  id: 'domain-widget',
  title: t('Example Asset'),
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
      conditions: '',
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

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'request-per-min-big-number',
      title: t('Requests per Minute'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: ['epm()'],
          columns: [],
          conditions: '',
          orderby: 'epm()',
        },
      ],
    },
    {
      id: 'average-encoded-size-big-number',
      title: t('Average Encoded Size'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`],
          columns: [],
          conditions: '',
          orderby: `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
        },
      ],
    },
    {
      id: 'average-decoded-size-big-number',
      title: t('Average Decoded Size'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`avg(${SpanFields.HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
          columns: [],
          conditions: '',
          orderby: `avg(${SpanFields.HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        },
      ],
    },
    {
      id: 'average-transfer-size-big-number',
      title: t('Average Transfer Size'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`avg(${SpanFields.HTTP_RESPONSE_TRANSFER_SIZE})`],
          columns: [],
          conditions: '',
          orderby: `avg(${SpanFields.HTTP_RESPONSE_TRANSFER_SIZE})`,
        },
      ],
    },
    {
      id: 'average-duration-big-number',
      title: t('Average Duration'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          conditions: '',
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
    {
      id: 'time-spent-big-number',
      title: t('Time Spent'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [`sum(${SpanFields.SPAN_SELF_TIME})`],
          columns: [],
          conditions: '',
          orderby: `sum(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
  ],
  1,
  {h: 1, minH: 1}
);

const THIRD_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
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
          conditions: '',
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
          conditions: '',
          orderby: `avg(${SpanFields.SPAN_SELF_TIME})`,
        },
      ],
    },
    {
      id: 'average-asset-size-widget',
      title: t('Average Asset Size'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [
            `avg(${SpanFields.HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
            `avg(${SpanFields.HTTP_RESPONSE_TRANSFER_SIZE})`,
            `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
          ],
          columns: [],
          conditions: '',
          fieldAliases: [
            t('Avg Decoded Size'),
            t('Avg Transfer Size'),
            t('Avg Encoded Size'),
          ],
          orderby: `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
        },
      ],
    },
  ],
  1
);

const ASSETS_TABLE_WIDGET: Widget = {
  id: 'assets-table-widget',
  title: t('Pages containing this asset'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
        SpanFields.RESOURCE_RENDER_BLOCKING_STATUS,
      ],
      aggregates: [
        'epm()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `avg(${SpanFields.HTTP_RESPONSE_CONTENT_LENGTH})`,
      ],
      columns: [SpanFields.TRANSACTION, SpanFields.RESOURCE_RENDER_BLOCKING_STATUS],
      fieldAliases: [
        t('Transaction'),
        t('Requests per Minutes'),
        t('Avg Duration'),
        t('Avg Encoded Size'),
        t('Render Blocking'),
      ],
      conditions: '',
      orderby: '-epm()',
    },
  ],
  layout: {
    x: 0,
    y: 5,
    minH: 2,
    h: 6,
    w: 6,
  },
};

export const FRONTEND_ASSETS_SUMMARY_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  filters: {
    globalFilter: [
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
          key: SpanFields.USER_GEO_SUBREGION,
          name: SpanFields.USER_GEO_SUBREGION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  title: SUMMARY_DASHBOARD_TITLE,
  widgets: [
    ASSET_DESCRIPTION_WIDGET,
    ...SECOND_ROW_WIDGETS,
    ...THIRD_ROW_WIDGETS,
    ASSETS_TABLE_WIDGET,
  ],
};
