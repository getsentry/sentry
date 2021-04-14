import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import {TimePeriod, TimeWindow} from 'app/views/settings/incidentRules/types';

export const TIME_OPTIONS: SelectValue<string>[] = [
  {label: t('Last 6 hours'), value: TimePeriod.SIX_HOURS},
  {label: t('Last 24 hours'), value: TimePeriod.ONE_DAY},
  {label: t('Last 3 days'), value: TimePeriod.THREE_DAYS},
  {label: t('Last 7 days'), value: TimePeriod.SEVEN_DAYS},
];

export const ALERT_RULE_DETAILS_DEFAULT_PERIOD = TimePeriod.ONE_DAY;

export const TIME_WINDOWS = {
  [TimePeriod.SIX_HOURS]: TimeWindow.ONE_HOUR * 6 * 60 * 1000,
  [TimePeriod.ONE_DAY]: TimeWindow.ONE_DAY * 60 * 1000,
  [TimePeriod.THREE_DAYS]: TimeWindow.ONE_DAY * 3 * 60 * 1000,
  [TimePeriod.SEVEN_DAYS]: TimeWindow.ONE_DAY * 7 * 60 * 1000,
};

export const API_INTERVAL_POINTS_LIMIT = 10000;
export const API_INTERVAL_POINTS_MIN = 150;
