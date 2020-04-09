import {t} from 'app/locale';
import {SelectValue} from 'app/types';

export enum DisplayModes {
  NONE = 'none',
  PREVIOUS = 'previous',
  RELEASES = 'releases',
}

export const DISPLAY_MODE_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.NONE, label: t('None')},
  {value: DisplayModes.PREVIOUS, label: t('Previous Period')},
  {value: DisplayModes.RELEASES, label: t('Release Markers')},
];

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count()', value: 'count()'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];
