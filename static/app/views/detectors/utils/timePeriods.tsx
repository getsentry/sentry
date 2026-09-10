import {t} from 'sentry/locale';
import {Dataset, TimePeriod, TimeWindow} from 'sentry/views/alerts/rules/metric/types';
import {isCrashFreeAlert} from 'sentry/views/detectors/utils/isCrashFreeAlert';

type TimePeriodMap = Omit<Record<TimePeriod, string>, TimePeriod.TWENTY_EIGHT_DAYS>;

/**
 * Time period display labels
 */
const TIME_PERIOD_MAP: TimePeriodMap = {
  [TimePeriod.SIX_HOURS]: t('Last 6 hours'),
  [TimePeriod.ONE_DAY]: t('Last 24 hours'),
  [TimePeriod.THREE_DAYS]: t('Last 3 days'),
  [TimePeriod.SEVEN_DAYS]: t('Last 7 days'),
  [TimePeriod.FOURTEEN_DAYS]: t('Last 14 days'),
};

/**
 * Most commonly used time periods (excluding 6 hours and 28 days)
 */
const MOST_TIME_PERIODS: readonly TimePeriod[] = [
  TimePeriod.ONE_DAY,
  TimePeriod.THREE_DAYS,
  TimePeriod.SEVEN_DAYS,
  TimePeriod.FOURTEEN_DAYS,
];

/**
 * TimeWindow determines data available in TimePeriod
 * If TimeWindow is small, lower TimePeriod to limit data points
 */
const AVAILABLE_TIME_PERIODS: Record<TimeWindow, readonly TimePeriod[]> = {
  [TimeWindow.ONE_MINUTE]: [
    TimePeriod.SIX_HOURS,
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
  ],
  [TimeWindow.FIVE_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.TEN_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.FIFTEEN_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.THIRTY_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.ONE_HOUR]: MOST_TIME_PERIODS,
  [TimeWindow.TWO_HOURS]: MOST_TIME_PERIODS,
  [TimeWindow.FOUR_HOURS]: [
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
  ],
  [TimeWindow.ONE_DAY]: [TimePeriod.FOURTEEN_DAYS],
};

/**
 * EAP (Events Analytics Platform) time periods
 */
const MOST_EAP_TIME_PERIOD = [
  TimePeriod.ONE_DAY,
  TimePeriod.THREE_DAYS,
  TimePeriod.SEVEN_DAYS,
];

/**
 * Available time periods for EAP alerts
 */
const EAP_AVAILABLE_TIME_PERIODS = {
  [TimeWindow.ONE_MINUTE]: [], // One minute intervals are not allowed on EAP Alerts
  [TimeWindow.FIVE_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.TEN_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.FIFTEEN_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.THIRTY_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.ONE_HOUR]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.TWO_HOURS]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.FOUR_HOURS]: [TimePeriod.SEVEN_DAYS],
  [TimeWindow.ONE_DAY]: [TimePeriod.SEVEN_DAYS],
};

interface TimePeriodOptions {
  dataset: Dataset;
  /**
   * The time window (interval) for data aggregation
   */
  timeWindow: TimeWindow;
}

/**
 * Get available time periods based on dataset and time window
 */
function getAvailableTimePeriods({
  dataset,
  timeWindow,
}: TimePeriodOptions): readonly TimePeriod[] | undefined {
  // For crash-free alerts, shorter intervals are not available due to backend limitations
  if (isCrashFreeAlert(dataset)) {
    // Only allow 1 hour and above intervals for crash-free alerts (matches metric alert behavior)
    const allowedTimeWindows = [
      TimeWindow.ONE_HOUR,
      TimeWindow.TWO_HOURS,
      TimeWindow.FOUR_HOURS,
      TimeWindow.ONE_DAY,
    ];

    if (!allowedTimeWindows.includes(timeWindow)) {
      return undefined;
    }

    return AVAILABLE_TIME_PERIODS[timeWindow];
  }

  // Events Analytics Platform has different restrictions
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return EAP_AVAILABLE_TIME_PERIODS[timeWindow];
  }

  return AVAILABLE_TIME_PERIODS[timeWindow];
}

/**
 * Get time period options formatted for select components
 */
export function getTimePeriodOptions(options: TimePeriodOptions) {
  const availablePeriods = getAvailableTimePeriods(options) ?? [];

  return availablePeriods.map(timePeriod => ({
    value: timePeriod,
    label: TIME_PERIOD_MAP[timePeriod as keyof typeof TIME_PERIOD_MAP],
  }));
}

/**
 * TimeWindow to interval mapping for chart data requests
 */

/**
 * Historical time period mappings for fetching background data
 */
export const HISTORICAL_TIME_PERIOD_MAP = {
  [TimePeriod.SIX_HOURS]: '678h',
  [TimePeriod.ONE_DAY]: '29d',
  [TimePeriod.THREE_DAYS]: '31d',
  [TimePeriod.SEVEN_DAYS]: '35d',
  [TimePeriod.FOURTEEN_DAYS]: '42d',
};

/**
 * Historical time period mappings for 5-minute intervals
 */
export const HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS = {
  ...HISTORICAL_TIME_PERIOD_MAP,
  [TimePeriod.SEVEN_DAYS]: '28d', // fetching 28 + 7 days of historical data at 5 minute increments exceeds the max number of data points that snuba can return
  [TimePeriod.FOURTEEN_DAYS]: '28d', // fetching 28 + 14 days of historical data at 5 minute increments exceeds the max number of data points that snuba can return
};

/**
 * EAP historical time period mappings (max 2688 buckets)
 */
export const EAP_HISTORICAL_TIME_PERIOD_MAP = {
  ...HISTORICAL_TIME_PERIOD_MAP,
  [TimePeriod.SEVEN_DAYS]: '28d',
  [TimePeriod.FOURTEEN_DAYS]: '28d',
};
