import {t} from 'app/locale';

import {DisplayType, Widget} from '../types';

export type WidgetTemplate = Widget;

export const DEFAULT_WIDGETS: Readonly<Array<WidgetTemplate>> = [
  {
    id: undefined,
    title: t('Total Errors'),
    displayType: DisplayType.BIG_NUMBER,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('All Events'),
    displayType: DisplayType.AREA,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Something Else'),
    displayType: DisplayType.BAR,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Total Errors 2'),
    displayType: DisplayType.BIG_NUMBER,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('All Events 2'),
    displayType: DisplayType.AREA,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Something Else 2'),
    displayType: DisplayType.BAR,
    interval: '24h',
    queries: [],
  },
];
