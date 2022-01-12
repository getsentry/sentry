import {t} from 'sentry/locale';

import {DisplayType, Widget, WidgetType} from '../types';

export type WidgetTemplate = Widget & {
  description: string;
};

export const DEFAULT_WIDGETS: Readonly<Array<WidgetTemplate>> = [
  {
    id: undefined,
    title: t('Duration Distribution'),
    description: t('Compare transaction durations across different percentiles.'),
    displayType: DisplayType.LINE,
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
    description: t('Top 5 transactions with the largest volume.'),
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
    title: t('LCP by Country'),
    description: t('Density map showing page load times by country.'),
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
    description: t('Unique users who have experienced slow load times.'),
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
    description: t('Percentage breakdown of transaction durations over and under 300ms.'),
    displayType: DisplayType.BAR,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:error',
        fields: [
          'equation|(count_if(transaction.duration,greater,300) / count()) * 100',
          'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100',
        ],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Latest Unresolved Issues'),
    description: t('Most recently seen unresolved issues.'),
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: 'is:unresolved',
        fields: ['issue', 'assignee', 'title'],
        orderby: 'date',
      },
    ],
  },
  {
    id: undefined,
    title: t('Top Unhandled Error Types'),
    description: t('Most frequently encountered unhandled errors.'),
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
    description: t('Footprint of unique users affected by errors.'),
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
