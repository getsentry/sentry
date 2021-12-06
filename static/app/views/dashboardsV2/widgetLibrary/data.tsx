import {t} from 'sentry/locale';

import {DisplayType, Widget, WidgetType} from '../types';

export type WidgetTemplate = Widget & {
  description: string;
};

export const DEFAULT_WIDGETS: Readonly<Array<WidgetTemplate>> = [
  {
    id: undefined,
    title: t('Total Errors'),
    description: 'Total number of error events in a given time interval.',
    displayType: DisplayType.BIG_NUMBER,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:transaction',
        fields: ['count()'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('All Events'),
    description: 'Area chart reflecting all error and transaction events.',
    displayType: DisplayType.AREA,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:transaction',
        fields: ['count()'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Affected Users'),
    description: 'Line chart that plots number of users impacted by errors.',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: 'Known Users',
        conditions: 'has:user.email !event.type:transaction',
        fields: ['count_unique(user)'],
        orderby: '',
      },
      {
        name: 'Anonymous Users',
        conditions: '!has:user.email !event.type:transaction',
        fields: ['count_unique(user)'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Handled vs. Unhandled'),
    description: 'Line chart that plots both handled and unhandled errors.',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: 'Handled',
        conditions: 'error.handled:true',
        fields: ['count()'],
        orderby: '',
      },
      {
        name: 'Unhandled',
        conditions: 'error.handled:false',
        fields: ['count()'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Errors by Country'),
    description: 'Map that shows where errors have occured in the world.',
    displayType: DisplayType.WORLD_MAP,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: 'Error counts',
        conditions: '!event.type:transaction has:geo.country_code',
        fields: ['count()'],
        orderby: '',
      },
    ],
  },
  {
    id: undefined,
    title: t('Errors by Browser'),
    description: 'Table that lists the browsers with error count.',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '!event.type:transaction has:browser.name',
        fields: ['browser.name', 'count()'],
        orderby: '-count',
      },
    ],
  },
];
