import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const SPAN_OPERATIONS_CONDITION =
  'span.op:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

const spanOperationsTable: Widget = {
  id: 'span-operations-table',
  title: 'Span Operations',
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
        `avg(${SpanFields.SLOW_FRAMES_RATE})`,
        `avg(${SpanFields.FROZEN_FRAMES_RATE})`,
        `avg(${SpanFields.MOBILE_FRAMES_DELAY})`,
      ],
      aggregates: [
        `avg(${SpanFields.SLOW_FRAMES_RATE})`,
        `avg(${SpanFields.FROZEN_FRAMES_RATE})`,
        `avg(${SpanFields.MOBILE_FRAMES_DELAY})`,
      ],
      columns: [SpanFields.SPAN_OP, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: ['Operation', 'Span Description', 'Slow', 'Frozen', 'Delay'],
      conditions: SPAN_OPERATIONS_CONDITION,
      orderby: '-avg(mobile.frames_delay)',
    },
  ],
  layout: {
    y: 0,
    h: 7,
    x: 0,
    minH: 2,
    w: 6,
  },
};

export const MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals Screen Rendering as a Dashboard'),
  projects: [],
  widgets: [spanOperationsTable],
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
