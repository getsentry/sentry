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
    title: t('Affected Users'),
    displayType: DisplayType.LINE,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Handled vs. Unhandled'),
    displayType: DisplayType.LINE,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Errors by Country'),
    displayType: DisplayType.WORLD_MAP,
    interval: '24h',
    queries: [],
  },
  {
    id: undefined,
    title: t('Errors by Browser'),
    displayType: DisplayType.TABLE,
    interval: '24h',
    queries: [],
  },
];
