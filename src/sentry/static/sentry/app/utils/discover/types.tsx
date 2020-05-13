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
  {value: DisplayModes.DEFAULT, label: t('Total Period')},
  {value: DisplayModes.PREVIOUS, label: t('Previous Period')},
  {value: DisplayModes.RELEASES, label: t('Release Markers')},
  {value: DisplayModes.TOP5, label: t('Top 5 Period')},
  {value: DisplayModes.DAILY, label: t('Total Daily')},
  {value: DisplayModes.DAILYTOP5, label: t('Top 5 Daily')},
];

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count()', value: 'count()'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];
