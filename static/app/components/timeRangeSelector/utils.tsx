import {Fragment} from 'react';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import {
  DEFAULT_DAY_END_TIME,
  DEFAULT_DAY_START_TIME,
  getFormattedDate,
} from 'sentry/utils/dates';

import TimeRangeItemLabel from './timeRangeItemLabel';
import type {TimeRangeItem} from './types';

type PeriodUnit = 's' | 'm' | 'h' | 'd' | 'w';
type RelativePeriodUnit = Exclude<PeriodUnit, 's'>;

type RelativeUnitsMapping = Record<
  string,
  {
    convertToDaysMultiplier: number;
    label: (num: number) => string;
    momentUnit: moment.unitOfTime.DurationConstructor;
    searchKey: string;
  }
>;

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

const STATS_PERIOD_REGEX = /^(\d+)([mhdw]{1})$/;

const SUPPORTED_RELATIVE_PERIOD_UNITS: RelativeUnitsMapping = {
  m: {
    label: (num: number) => tn('Last minute', 'Last %s minutes', num),
    searchKey: t('minutes'),
    momentUnit: 'minutes',
    convertToDaysMultiplier: 1 / (60 * 24),
  },
  h: {
    label: (num: number) => tn('Last hour', 'Last %s hours', num),
    searchKey: t('hours'),
    momentUnit: 'hours',
    convertToDaysMultiplier: 1 / 24,
  },
  d: {
    label: (num: number) => tn('Last day', 'Last %s days', num),
    searchKey: t('days'),
    momentUnit: 'days',
    convertToDaysMultiplier: 1,
  },
  w: {
    label: (num: number) => tn('Last week', 'Last %s weeks', num),
    searchKey: t('weeks'),
    momentUnit: 'weeks',
    convertToDaysMultiplier: 7,
  },
};

const SUPPORTED_RELATIVE_UNITS_LIST = Object.keys(
  SUPPORTED_RELATIVE_PERIOD_UNITS
) as RelativePeriodUnit[];

const parseStatsPeriodString = (statsPeriodString: string) => {
  const result = STATS_PERIOD_REGEX.exec(statsPeriodString);

  if (result === null) {
    throw new Error('Invalid stats period');
  }

  const value = parseInt(result[1]!, 10);
  const unit = result[2] as RelativePeriodUnit;

  return {
    value,
    unit,
  };
};

/**
 * Converts a relative stats period, e.g. `1h` to an object containing a start
 * and end date, with the end date as the current time and the start date as the
 * time that is the current time less the statsPeriod.
 *
 * @param statsPeriod Relative stats period
 * @param outputFormat Format of outputted start/end date
 * @return Object containing start and end date as YYYY-MM-DDTHH:mm:ss
 *
 */
export function parseStatsPeriod(
  statsPeriod: string,
  outputFormat: string | null = DATE_TIME_FORMAT,
  utc = false
): {end: string; start: string} {
  const {value, unit} = parseStatsPeriodString(statsPeriod);

  const momentUnit = SUPPORTED_RELATIVE_PERIOD_UNITS[unit]!.momentUnit;

  const format = outputFormat === null ? undefined : outputFormat;

  const momentFn = utc ? moment.utc : moment;

  return {
    start: momentFn().subtract(value, momentUnit).format(format),
    end: momentFn().format(format),
  };
}

/**
 * Given a relative stats period, e.g. `1h`, return a pretty string if it
 * is a default stats period. Otherwise if it's a valid period (can be any number
 * followed by a single character s|m|h|d) display "Other" or "Invalid period" if invalid
 *
 * @param relative Relative stats period
 * @return either one of the default "Last x days" string, "Other" if period is valid on the backend, or "Invalid period" otherwise
 */
export function getRelativeSummary(
  relative: string,
  relativeOptions?: Record<string, React.ReactNode>
): string {
  try {
    const defaultRelativePeriodString =
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      relativeOptions?.[relative] ?? DEFAULT_RELATIVE_PERIODS[relative];

    if (defaultRelativePeriodString) {
      return defaultRelativePeriodString;
    }

    const {value, unit} = parseStatsPeriodString(relative);

    return SUPPORTED_RELATIVE_PERIOD_UNITS[unit]!.label(value);
  } catch {
    return 'Invalid period';
  }
}

/**
 * Returns an absolute time range summary given the start and end timestamps. If the
 * start/end time coincides with the default day start/end time, then the returned
 * summary will include the date only (e.g. "Jan 1–Jan 2"). Otherwise, both the date and
 * time will be shown (e.g. "Jan 1, 1:00 AM–Jan 2, 11:00PM").
 */
export function getAbsoluteSummary(
  start: DateString,
  end: DateString,
  utc?: boolean | null
) {
  // XXX: These are NOT used for display purpose but only to determine if the
  // dates are at the start or end of the day
  const startTimeFormatted = getFormattedDate(start, 'HH:mm:ss', {local: true});
  const endTimeFormatted = getFormattedDate(end, 'HH:mm:ss', {local: true});

  const showDateOnly =
    startTimeFormatted === DEFAULT_DAY_START_TIME &&
    endTimeFormatted === DEFAULT_DAY_END_TIME;

  return (
    <Fragment>
      <DateTime date={start} dateOnly={showDateOnly} utc={!!utc} />
      {'–'}
      <DateTime date={end} dateOnly={showDateOnly} utc={!!utc} />
    </Fragment>
  );
}

export function makeItem(
  amount: number,
  unit: string,
  label: (num: number) => string
): TimeRangeItem {
  return {
    value: `${amount}${unit}`,
    label: <TimeRangeItemLabel>{label(amount)}</TimeRangeItemLabel>,
    textValue: `${amount}${unit}`,
  };
}

function timePeriodIsWithinLimit<T extends RelativeUnitsMapping>({
  amount,
  unit,
  maxDays,
  supportedPeriods,
}: {
  amount: number;
  supportedPeriods: T;
  unit: keyof T & string;
  maxDays?: number;
}) {
  if (!maxDays) {
    return true;
  }

  const daysMultiplier = supportedPeriods[unit]!.convertToDaysMultiplier;
  const numberOfDays = amount * daysMultiplier;

  return numberOfDays <= maxDays;
}

function filterItems(items: TimeRangeItem[], inputValue: string): TimeRangeItem[] {
  return items.filter(item =>
    (typeof item.textValue === 'string' && item.textValue.length > 0
      ? item.textValue
      : `${item.value}`
    )
      .toLowerCase()
      .includes(inputValue.toLowerCase())
  );
}

/**
 * A custom autocomplete implementation for <TimeRangeSelector />
 * This function generates relative time ranges based on the user's input (not limited to those present in the initial set).
 *
 * When the user begins their input with a number, we provide all unit options for them to choose from:
 * "5" => ["Last 5 seconds", "Last 5 minutes", "Last 5 hours", "Last 5 days", "Last 5 weeks"]
 *
 * When the user adds text after the number, we filter those options to the matching unit:
 * "5d" => ["Last 5 days"]
 * "5 days" => ["Last 5 days"]
 *
 * If the input does not begin with a number, we do a simple filter of the preset options.
 */
export const _timeRangeAutoCompleteFilter = function <T extends RelativeUnitsMapping>(
  items: TimeRangeItem[] | null,
  filterValue: string,
  {
    supportedPeriods,
    supportedUnits,
    maxDays,
    maxDateRange,
  }: {
    supportedPeriods: T;
    supportedUnits: Array<keyof T & string>;
    maxDateRange?: number;
    maxDays?: number;
  }
): TimeRangeItem[] {
  if (!items) {
    return [];
  }

  const match = filterValue.match(/(?<digits>\d+)\s*(?<string>\w*)/);

  const userSuppliedAmount = Number(match?.groups?.digits);
  const userSuppliedUnits = (match?.groups?.string ?? '').trim().toLowerCase();

  const userSuppliedAmountIsValid = !isNaN(userSuppliedAmount) && userSuppliedAmount > 0;

  // If there is a number w/o units, show all unit options within limit
  if (userSuppliedAmountIsValid && !userSuppliedUnits) {
    return supportedUnits
      .filter(unit =>
        timePeriodIsWithinLimit({
          amount: userSuppliedAmount,
          unit,
          maxDays: maxDateRange ?? maxDays,
          supportedPeriods,
        })
      )
      .map(unit => makeItem(userSuppliedAmount, unit, supportedPeriods[unit]!.label));
  }

  // If there is a number followed by units, show the matching number/unit option
  if (userSuppliedAmountIsValid && userSuppliedUnits) {
    const matchingUnit = supportedUnits.find(unit => {
      if (userSuppliedUnits.length === 1) {
        return unit === userSuppliedUnits;
      }

      return supportedPeriods[unit]!.searchKey.startsWith(userSuppliedUnits);
    });

    if (
      matchingUnit &&
      timePeriodIsWithinLimit({
        amount: userSuppliedAmount,
        unit: matchingUnit,
        maxDays,
        supportedPeriods,
      })
    ) {
      return [
        makeItem(userSuppliedAmount, matchingUnit, supportedPeriods[matchingUnit]!.label),
      ];
    }
  }

  // Otherwise, do a normal filter search
  return filterItems(items, filterValue);
};

export const timeRangeAutoCompleteFilter = function (
  items: TimeRangeItem[] | null,
  filterValue: string,
  options: {
    maxDateRange?: number;
    maxDays?: number;
    supportedPeriods?: RelativeUnitsMapping;
    supportedUnits?: RelativePeriodUnit[];
  }
): TimeRangeItem[] {
  return _timeRangeAutoCompleteFilter(items, filterValue, {
    supportedPeriods: SUPPORTED_RELATIVE_PERIOD_UNITS,
    supportedUnits: SUPPORTED_RELATIVE_UNITS_LIST,
    ...options,
  });
};

/**
 * Returns an object whose key is the arbitrary period string and whose value is a
 * human-readable label for that period. E.g. '2h' returns {'2h': 'Last 2 hours'}.
 */
export function getArbitraryRelativePeriod(arbitraryPeriod?: string | null) {
  // If arbitraryPeriod is invalid
  if (!arbitraryPeriod || !STATS_PERIOD_REGEX.exec(arbitraryPeriod)) {
    return {};
  }

  // Get the custom period label ("8D" --> "8 Days")
  const {value, unit} = parseStatsPeriodString(arbitraryPeriod);
  return {[arbitraryPeriod]: SUPPORTED_RELATIVE_PERIOD_UNITS[unit]!.label(value)};
}

/**
 * Returns an object with sorted relative time periods, where the period with the most
 * recent start time comes first (e.g. 1H — 2H - 1D — 7D…)
 */
export function getSortedRelativePeriods(
  relativePeriods: Record<string, React.ReactNode>
) {
  const entries = Object.entries(relativePeriods);

  const validPeriods = entries.filter(([period]) => !!STATS_PERIOD_REGEX.exec(period));
  const invalidPeriods = entries.filter(([period]) => !STATS_PERIOD_REGEX.exec(period));

  const sortedValidPeriods = validPeriods.sort((a, b) => {
    const [periodA] = a;
    const [periodB] = b;

    return moment(parseStatsPeriod(periodB).start).diff(
      moment(parseStatsPeriod(periodA).start)
    );
  });
  return Object.fromEntries(invalidPeriods.concat(sortedValidPeriods));
}
