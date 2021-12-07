import {t} from 'sentry/locale';

import {DisplayType, Widget, WidgetType} from '../types';

export type WidgetTemplate = Widget & {
  description: string;
};

export const DEFAULT_WIDGETS: Readonly<Array<WidgetTemplate>> = [
  {
    id: undefined,
    title: t('Duration Distribution'),
    description: 'Compare transaction durations across different percentiles.',
    displayType: DisplayType.AREA,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:error',
        fields: [
          'p50(transaction.duration)',
          'p75(transaction.duration)',
          'p95(transaction.duration)',
        ],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('High Throughput Transactions'),
    description: 'Top 5 transactions with the largest volume.',
    displayType: DisplayType.TOP_N,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:error',
        fields: ['transaction', 'count()'],
        orderby: '-count',
      },
    ],
  },
  {
    id: undefined,
    title: t('LCP by Country (Frontend)'),
    description: 'Map showing page load times by country.',
    displayType: DisplayType.WORLD_MAP,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: 'has:geo.country_code',
        fields: ['p75(measurements.lcp)'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Miserable Users'),
    description: 'Unique users who have experienced slow load times.',
    displayType: DisplayType.BIG_NUMBER,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '',
        fields: ['count_miserable(user,300)'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Slow vs Fast Transactions'),
    description: 'Breakdown of transaction durations over and under 300ms',
    displayType: DisplayType.BAR,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:error',
        fields: [
          'count_if(transaction.duration,greater,300)',
          'count_if(transaction.duration,lessOrEquals,300)',
        ],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Top Issues'),
    description: 'Issues with the most error events.',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: 'event.type:error',
        fields: ['issue', 'count()', 'any(message)'],
        orderby: '-count',
      },
    ],
  },
  {
    id: undefined,
    title: t('Top Unhandled Error Types'),
    description: 'Most frequently encountered unhandled errors.',
    displayType: DisplayType.TOP_N,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: 'error.unhandled:true',
        fields: ['error.type', 'count()'],
        orderby: '-count',
      },
    ],
  },
  {
    id: undefined,
    title: t('Users Affected by Errors'),
    description: 'Footprint of unique users affected by errors.',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: 'event.type:error',
        fields: ['count_unique(user)', 'count()'],
        orderby: '',
      },
    ],
  },
];
