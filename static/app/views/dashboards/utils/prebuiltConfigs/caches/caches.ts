import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/caches/settings';
import {
  WIDGET_COLUMN_LABELS,
  TABLE_MIN_HEIGHT,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const BASE_CONDITION = `${SpanFields.SPAN_OP}:[cache.get,cache.get_item]`;

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'cache-hits-widget',
      title: t('Miss Rate'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: [
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          columns: [],
          fields: [
            `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
          ],
          conditions: BASE_CONDITION,
          orderby: `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'throughput-widget',
      title: t('Throughput'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '5m',
      queries: [
        {
          name: '',
          aggregates: ['epm()'],
          columns: [],
          fields: ['epm()'],
          conditions: BASE_CONDITION,
          orderby: 'epm()',
        },
      ],
    },
  ],
  0
);

const TRANSACTION_TABLE: Widget = {
  id: 'transaction-table',
  title: t('Transactions'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        SpanFields.PROJECT,
        `avg(${SpanFields.CACHE_ITEM_SIZE})`,
        'epm()',
        `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `avg(${SpanFields.CACHE_ITEM_SIZE})`,
        'epm()',
        `equation|count_if(${SpanFields.CACHE_HIT},equals,false) / count(${SpanFields.SPAN_DURATION})`,
        `sum(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION, SpanFields.PROJECT],
      fieldAliases: [
        WIDGET_COLUMN_LABELS.transaction,
        WIDGET_COLUMN_LABELS.project,
        t('Avg Value Size'),
        t('Requests Per Minute'),
        t('Miss Rate'),
        WIDGET_COLUMN_LABELS.timeSpent,
      ],
      conditions: BASE_CONDITION,
      orderby: `-sum(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    y: 3,
    w: 6,
    h: 6,
    minH: TABLE_MIN_HEIGHT,
  },
};

export const CACHES_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, TRANSACTION_TABLE],
  onboarding: {type: 'module', moduleName: ModuleName.CACHE},
};
