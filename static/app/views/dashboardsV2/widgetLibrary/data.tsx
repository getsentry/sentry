import {t} from 'app/locale';

import {DisplayType, Widget} from '../types';

export type WidgetTemplate = Widget;

export const DEFAULT_WIDGETS: Readonly<Array<WidgetTemplate>> = [
  {
    id: undefined,
    title: t('Total Errors'),
    displayType: DisplayType.BIG_NUMBER,
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
    displayType: DisplayType.AREA,
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
    displayType: DisplayType.LINE,
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
    displayType: DisplayType.LINE,
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
    displayType: DisplayType.WORLD_MAP,
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
    displayType: DisplayType.TABLE,
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
