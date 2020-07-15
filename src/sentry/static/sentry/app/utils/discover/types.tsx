import {t} from 'app/locale';
import {SelectValue} from 'app/types';

export const TOP_N = 5;

export enum DisplayModes {
  DEFAULT = 'default',
  PREVIOUS = 'previous',
  TOP5 = 'top5',
  DAILY = 'daily',
  DAILYTOP5 = 'dailytop5',
}

export const DISPLAY_MODE_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.DEFAULT, label: t('Total Period')},
  {value: DisplayModes.PREVIOUS, label: t('Previous Period')},
  {value: DisplayModes.TOP5, label: t('Top 5 Period')},
  {value: DisplayModes.DAILY, label: t('Total Daily')},
  {value: DisplayModes.DAILYTOP5, label: t('Top 5 Daily')},
];

export const DISPLAY_MODE_FALLBACK_OPTIONS = {
  [DisplayModes.DEFAULT]: DisplayModes.DEFAULT,
  [DisplayModes.PREVIOUS]: DisplayModes.DEFAULT,
  [DisplayModes.TOP5]: DisplayModes.DEFAULT,
  [DisplayModes.DAILY]: DisplayModes.DAILY,
  [DisplayModes.DAILYTOP5]: DisplayModes.DAILY,
};

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count()', value: 'count()'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];
