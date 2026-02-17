import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const SPAN_OPERATIONS_CONDITION = `${SpanFields.SPAN_OP}:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]`;

const SPAN_OPERATIONS_TABLE: Widget = {
  id: 'span-operations-table',
  title: t('Span Operations'),
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  queries: [
    {
      name: '',
      fields: [
        SpanFields.SPAN_OP,
        SpanFields.SPAN_DESCRIPTION,
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `avg(${SpanFields.MOBILE_FRAMES_DELAY})`,
      ],
      aggregates: [
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `avg(${SpanFields.MOBILE_FRAMES_DELAY})`,
      ],
      columns: [SpanFields.SPAN_OP, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: [
        'Operation',
        'Span Description',
        'Slow Frames',
        'Frozen Frames',
        'Total Frames',
        'Slow Frame %',
        'Frozen Frame %',
        'Delay',
      ],
      fieldMeta: [
        null,
        null,
        null,
        null,
        null,
        {valueType: 'percentage', valueUnit: null},
        {valueType: 'percentage', valueUnit: null},
        null,
      ],
      conditions: SPAN_OPERATIONS_CONDITION,
      orderby: '-avg(mobile.frames_delay)',
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
  title: t('Mobile Vitals Screen Rendering'),
  projects: [],
  widgets: [SPAN_OPERATIONS_TABLE],
  filters: {
    globalFilter: [
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
};
