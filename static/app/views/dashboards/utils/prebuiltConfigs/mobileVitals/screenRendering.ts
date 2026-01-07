import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';

const SPAN_OPERATIONS_CONDITION =
  'span.op:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

export const MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: 'Mobile Vitals Screen Rendering as a Dashboard',
  projects: [],
  widgets: [
    {
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
            'span.op',
            'span.description',
            'avg(measurements.frames_slow_rate)',
            'avg(measurements.frames_frozen_rate)',
            'avg(mobile.frames_delay)',
          ],
          aggregates: [
            'avg(measurements.frames_slow_rate)',
            'avg(measurements.frames_frozen_rate)',
            'avg(mobile.frames_delay)',
          ],
          columns: ['span.op', 'span.description'],
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
    },
  ],
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
          key: 'span.op',
          name: 'span.op',
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'device.class',
          name: 'device.class',
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
