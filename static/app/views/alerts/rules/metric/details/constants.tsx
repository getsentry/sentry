import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {TimePeriod, TimeWindow} from 'sentry/views/alerts/rules/metric/types';

export const SELECTOR_RELATIVE_PERIODS = {
  [TimePeriod.SIX_HOURS]: t('Last 6 hours'),
  [TimePeriod.ONE_DAY]: t('Last 24 hours'),
  [TimePeriod.THREE_DAYS]: t('Last 3 days'),
  [TimePeriod.SEVEN_DAYS]: t('Last 7 days'),
};

export const ALERT_DEFAULT_CHART_PERIOD = '7d';

export const TIME_OPTIONS: Array<SelectValue<string>> = [
  {label: t('Last 6 hours'), value: TimePeriod.SIX_HOURS},
  {label: t('Last 24 hours'), value: TimePeriod.ONE_DAY},
  {label: t('Last 3 days'), value: TimePeriod.THREE_DAYS},
  {label: t('Last 7 days'), value: TimePeriod.SEVEN_DAYS},
  {label: t('Last 14 days'), value: TimePeriod.FOURTEEN_DAYS},
  {label: t('Last 28 days'), value: TimePeriod.TWENTY_EIGHT_DAYS},
];

export const TIME_WINDOWS = {
  [TimePeriod.SIX_HOURS]: TimeWindow.ONE_HOUR * 6 * 60 * 1000,
  [TimePeriod.ONE_DAY]: TimeWindow.ONE_DAY * 60 * 1000,
  [TimePeriod.THREE_DAYS]: TimeWindow.ONE_DAY * 3 * 60 * 1000,
  [TimePeriod.SEVEN_DAYS]: TimeWindow.ONE_DAY * 7 * 60 * 1000,
  [TimePeriod.FOURTEEN_DAYS]: TimeWindow.ONE_DAY * 14 * 60 * 1000,
  [TimePeriod.TWENTY_EIGHT_DAYS]: TimeWindow.ONE_DAY * 28 * 60 * 1000,
};

export const API_INTERVAL_POINTS_LIMIT = 10000;
export const API_INTERVAL_POINTS_MIN = 150;

export type TimePeriodType = {
  display: React.ReactNode;
  end: string;
  label: string;
  period: string;
  start: string;
  /**
   * The start/end were chosen from the period and not the user
   */
  usingPeriod: boolean;
  custom?: boolean;
  utc?: boolean;
};

// A La models/alert_rule.py::AlertRuleStatus
export const ALERT_RULE_STATUS = {
  PENDING: 0,
  SNAPSHOT: 4,
  DISABLED: 5,
  NOT_ENOUGH_DATA: 6,
};
