import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';

const COLD_START_CONDITION =
  'span.op:app.start.cold span.description:["Cold Start","Cold App Start"]';
const WARM_START_CONDITION =
  'span.op:app.start.warm span.description:["Warm Start","Warm App Start"]';
const OPERATIONS_CONDITION =
  '!span.description:"Cold Start" !span.description:"Warm Start" !span.description:"Cold App Start" !span.description:"Warm App Start" !span.description:"Initial Frame Render" has:span.description transaction.op:[ui.load,navigation] has:ttid app_start_type:cold span.op:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

export const MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: 'Mobile Vitals App Start as a Dashboard',
  projects: [],
  widgets: [
    {
      id: 'avg-cold-start-line',
      title: 'Average Cold Start',
      description: '',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['avg(span.duration)'],
          aggregates: ['avg(span.duration)'],
          columns: [],
          fieldAliases: [],
          conditions: COLD_START_CONDITION,
          orderby: 'avg(span.duration)',
        },
      ],
      layout: {
        x: 0,
        minH: 2,
        w: 3,
        y: 0,
        h: 2,
      },
    },
    {
      id: 'avg-warm-start-line',
      title: 'Average Warm Start',
      description: '',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['avg(span.duration)'],
          aggregates: ['avg(span.duration)'],
          columns: [],
          fieldAliases: [],
          conditions: WARM_START_CONDITION,
          orderby: 'avg(span.duration)',
        },
      ],
      layout: {
        x: 0,
        minH: 2,
        w: 3,
        y: 2,
        h: 2,
      },
    },
    {
      id: 'cold-start-device-distribution-table',
      title: 'Cold Start Device Distribution',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['device.class', 'avg(measurements.app_start_cold)'],
          aggregates: ['avg(measurements.app_start_cold)'],
          columns: ['device.class'],
          fieldAliases: ['', ''],
          conditions: '',
          orderby: '-avg(measurements.app_start_cold)',
        },
      ],
      layout: {
        x: 3,
        minH: 2,
        w: 3,
        y: 0,
        h: 2,
      },
    },
    {
      id: 'warm-start-device-distribution-table',
      title: 'Warm Start Device Distribution',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['device.class', 'avg(measurements.app_start_warm)'],
          aggregates: ['avg(measurements.app_start_warm)'],
          columns: ['device.class'],
          fieldAliases: ['', ''],
          conditions: '',
          orderby: '-avg(measurements.app_start_warm)',
        },
      ],
      layout: {
        x: 3,
        minH: 2,
        w: 3,
        y: 2,
        h: 2,
      },
    },
    {
      id: 'operations-table',
      title: 'Operations',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['span.op', 'span.description', 'avg(span.self_time)'],
          aggregates: ['avg(span.self_time)'],
          columns: ['span.op', 'span.description'],
          fieldAliases: ['Operation', 'Description', 'AVG Duration'],
          conditions: OPERATIONS_CONDITION,
          orderby: '-avg(span.self_time)',
        },
      ],
      layout: {
        x: 0,
        minH: 2,
        w: 6,
        y: 4,
        h: 6,
      },
    },
    {
      id: 'span-events-table',
      title: 'Span Events',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: ['id', 'span.duration', 'span.duration'],
          aggregates: [],
          columns: ['id', 'span.duration', 'span.duration'],
          fieldAliases: ['Transaction id', 'Profile', ''],
          conditions: '',
          orderby: '-id',
        },
      ],
      layout: {
        x: 0,
        minH: 2,
        w: 6,
        y: 10,
        h: 4,
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
