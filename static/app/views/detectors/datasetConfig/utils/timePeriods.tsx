import {t} from 'sentry/locale';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

export enum MetricDetectorTimePeriod {
  SIX_HOURS = '6h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  SEVEN_DAYS = '7d',
  FOURTEEN_DAYS = '14d',
  TWENTY_EIGHT_DAYS = '28d',
}

export enum MetricDetectorInterval {
  ONE_MINUTE = 1,
  FIVE_MINUTES = 5,
  TEN_MINUTES = 10,
  FIFTEEN_MINUTES = 15,
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  TWO_HOURS = 120,
  FOUR_HOURS = 240,
  ONE_DAY = 1440,
}

export const BASE_INTERVALS: readonly MetricDetectorInterval[] = [
  MetricDetectorInterval.ONE_MINUTE,
  MetricDetectorInterval.FIVE_MINUTES,
  MetricDetectorInterval.TEN_MINUTES,
  MetricDetectorInterval.FIFTEEN_MINUTES,
  MetricDetectorInterval.THIRTY_MINUTES,
  MetricDetectorInterval.ONE_HOUR,
  MetricDetectorInterval.TWO_HOURS,
  MetricDetectorInterval.FOUR_HOURS,
  MetricDetectorInterval.ONE_DAY,
];

export const BASE_DYNAMIC_INTERVALS: readonly MetricDetectorInterval[] = [
  MetricDetectorInterval.FIFTEEN_MINUTES,
  MetricDetectorInterval.THIRTY_MINUTES,
  MetricDetectorInterval.ONE_HOUR,
];

const STANDARD_TIME_PERIODS_MAP: Record<
  MetricDetectorInterval,
  MetricDetectorTimePeriod[]
> = {
  [MetricDetectorInterval.ONE_MINUTE]: [
    MetricDetectorTimePeriod.SIX_HOURS,
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.FIVE_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
  ],
  [MetricDetectorInterval.TEN_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
  ],
  [MetricDetectorInterval.FIFTEEN_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
  [MetricDetectorInterval.THIRTY_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
  [MetricDetectorInterval.ONE_HOUR]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
  [MetricDetectorInterval.TWO_HOURS]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
  [MetricDetectorInterval.FOUR_HOURS]: [
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
  [MetricDetectorInterval.ONE_DAY]: [
    MetricDetectorTimePeriod.FOURTEEN_DAYS,
    MetricDetectorTimePeriod.TWENTY_EIGHT_DAYS,
  ],
};

const EAP_TIME_PERIODS_MAP: Record<MetricDetectorInterval, MetricDetectorTimePeriod[]> = {
  [MetricDetectorInterval.ONE_MINUTE]: [],
  [MetricDetectorInterval.FIVE_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.TEN_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.FIFTEEN_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.THIRTY_MINUTES]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.ONE_HOUR]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.TWO_HOURS]: [
    MetricDetectorTimePeriod.ONE_DAY,
    MetricDetectorTimePeriod.THREE_DAYS,
    MetricDetectorTimePeriod.SEVEN_DAYS,
  ],
  [MetricDetectorInterval.FOUR_HOURS]: [MetricDetectorTimePeriod.SEVEN_DAYS],
  [MetricDetectorInterval.ONE_DAY]: [MetricDetectorTimePeriod.SEVEN_DAYS],
};

export function getStandardTimePeriodsForInterval(
  interval: MetricDetectorInterval
): MetricDetectorTimePeriod[] {
  return STANDARD_TIME_PERIODS_MAP[interval] ?? [];
}

export function getEapTimePeriodsForInterval(
  interval: MetricDetectorInterval
): MetricDetectorTimePeriod[] {
  return EAP_TIME_PERIODS_MAP[interval] ?? [];
}

/**
 * Return a human-readable label for a time period, mirroring TIME_PERIOD_MAP.
 * Uses hours for 1d (Last 24 hours) and days for multi-day periods.
 */
export function getTimePeriodLabel(period: MetricDetectorTimePeriod): string {
  const hours = parsePeriodToHours(period as unknown as string);
  if (hours <= 0) {
    return period as unknown as string;
  }
  if (hours <= 24) {
    return t('Last %s hours', hours);
  }
  if (hours % 24 === 0) {
    return t('Last %s days', hours / 24);
  }
  return t('Last %s hours', hours);
}
