import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SCREEN_RENDERING_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/settings';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const SCREEN_RENDERING_CONDITION = `${SpanFields.IS_TRANSACTION}:true ${SpanFields.TRANSACTION_OP}:[ui.load,navigation] has:${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT} has:${SpanFields.TRANSACTION}`;

const SCREEN_RENDERING_TABLE: Widget = {
  id: 'span-operations-table',
  title: t('Screen Rendering'),
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `avg(${SpanFields.APP_VITALS_FRAMES_DELAY_VALUE})`,
      ],
      aggregates: [
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `avg(${SpanFields.APP_VITALS_FRAMES_DELAY_VALUE})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [t('Transaction'), 'Slow Frame %', 'Frozen Frame %', 'Delay'],
      conditions: SCREEN_RENDERING_CONDITION,
      orderby: `-avg(${SpanFields.APP_VITALS_FRAMES_DELAY_VALUE})`,
    },
  ],
  layout: {
    h: 7,
    x: 0,
    y: 0,
    w: 6,
    minH: 2,
  },
};

export const MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: SCREEN_RENDERING_DASHBOARD_TITLE,
  projects: [],
  widgets: [SCREEN_RENDERING_TABLE],
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'os.name',
          name: 'os.name',
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'transaction',
          name: 'transaction',
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
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.DEVICE_CLASS,
          name: SpanFields.DEVICE_CLASS,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'user.geo.region',
          name: 'user.geo.region',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  onboarding: {type: 'module', moduleName: ModuleName.SCREEN_RENDERING},
};
