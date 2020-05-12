import {t} from 'app/locale';
import {SelectValue} from 'app/types';

export enum DisplayModes {
  DEFAULT = 'default',
  PREVIOUS = 'previous',
  RELEASES = 'releases',
  TOP5 = 'top5',
  DAILY = 'daily',
  DAILYTOP5 = 'dailytop5',
}

export const DISPLAY_MODE_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.DEFAULT, label: t('Default')},
  {value: DisplayModes.PREVIOUS, label: t('Previous Period')},
  {value: DisplayModes.RELEASES, label: t('Release Markers')},
  {value: DisplayModes.TOP5, label: t('Top 5 Breakdown')},
  {value: DisplayModes.DAILY, label: t('Bar (Daily Total)')},
  {value: DisplayModes.DAILYTOP5, label: t('Top 5 (Daily Total)')},
];

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count()', value: 'count()'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];
