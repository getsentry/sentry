import {Release} from '@sentry/release-parser';
import round from 'lodash/round';
import moment from 'moment';

import {t, tn} from 'sentry/locale';
import {CommitAuthor, User} from 'sentry/types';
import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fields';

export function userDisplayName(user: User | CommitAuthor, includeEmail = true): string {
  let displayName = String(user?.name ?? t('Unknown author')).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(user?.email ?? '').trim();

  if (email.length > 0 && email !== displayName && includeEmail) {
    displayName += ' (' + email + ')';
  }
  return displayName;
}

export const isSemverRelease = (rawVersion: string): boolean => {
  try {
    const parsedVersion = new Release(rawVersion);
    return !!parsedVersion.versionParsed;
  } catch {
    return false;
  }
};

export const formatVersion = (rawVersion: string, withPackage = false) => {
  try {
    const parsedVersion = new Release(rawVersion);
    const versionToDisplay = parsedVersion.describe();

    if (versionToDisplay.length) {
      return `${versionToDisplay}${
        withPackage && parsedVersion.package ? `, ${parsedVersion.package}` : ''
      }`;
    }

    return rawVersion;
  } catch {
    return rawVersion;
  }
};

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

// in milliseconds
export const MONTH = 2629800000;
export const WEEK = 604800000;
export const DAY = 86400000;
export const HOUR = 3600000;
export const MINUTE = 60000;
export const SECOND = 1000;

/**
 * Returns a human redable duration rounded to the largest unit.
 *
 * e.g. 2 days, or 3 months, or 25 seoconds
 *
 * Use `getExactDuration` for exact durations
 */

const DURATION_LABELS = {
  mo: t('mo'),
  w: t('w'),
  wk: t('wk'),
  week: t('week'),
  weeks: t('weeks'),
  d: t('d'),
  day: t('day'),
  days: t('days'),
  h: t('h'),
  hr: t('hr'),
  hour: t('hour'),
  hours: t('hours'),
  m: t('m'),
  min: t('min'),
  minute: t('minute'),
  minutes: t('minutes'),
  s: t('s'),
  sec: t('sec'),
  secs: t('secs'),
  second: t('second'),
  seconds: t('seconds'),
  ms: t('ms'),
  millisecond: t('millisecond'),
  milliseconds: t('milliseconds'),
};
export function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false,
  extraShort: boolean = false,
  absolute: boolean = false
): string {
  const absValue = Math.abs(seconds * 1000);

  // value in milliseconds
  const msValue = absolute ? absValue : seconds * 1000;

  if (absValue >= MONTH && !extraShort) {
    const {label, result} = roundWithFixed(msValue / MONTH, fixedDigits);
    return `${label}${
      abbreviation ? DURATION_LABELS.mo : ` ${tn('month', 'months', result)}`
    }`;
  }

  if (absValue >= WEEK) {
    const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.w}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.wk}`;
    }
    return `${label} ${tn('week', 'weeks', result)}`;
  }

  if (absValue >= DAY) {
    const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);

    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.d}`;
    }
    return `${label} ${tn('day', 'days', result)}`;
  }

  if (absValue >= HOUR) {
    const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.h}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.hr}`;
    }
    return `${label} ${tn('hour', 'hours', result)}`;
  }

  if (absValue >= MINUTE) {
    const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.m}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.min}`;
    }
    return `${label} ${tn('minute', 'minutes', result)}`;
  }

  if (absValue >= SECOND) {
    const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.s}`;
    }
    return `${label} ${tn('second', 'seconds', result)}`;
  }

  const {label, result} = roundWithFixed(msValue, fixedDigits);

  if (extraShort || abbreviation) {
    return `${label}${DURATION_LABELS.ms}`;
  }

  return `${label} ${tn('millisecond', 'milliseconds', result)}`;
}

const SUFFIX_ABBR = {
  years: t('yr'),
  weeks: t('wk'),
  days: t('d'),
  hours: t('hr'),
  minutes: t('min'),
  seconds: t('s'),
  milliseconds: t('ms'),
};
/**
 * Returns a human readable exact duration.
 * 'precision' arg will truncate the results to the specified suffix
 *
 * e.g. 1 hour 25 minutes 15 seconds
 */
export function getExactDuration(
  seconds: number,
  abbreviation: boolean = false,
  precision: keyof typeof SUFFIX_ABBR = 'milliseconds'
) {
  const minSuffix = ` ${precision}`;

  const convertDuration = (secs: number, abbr: boolean): string => {
    // value in milliseconds
    const msValue = round(secs * 1000);
    const value = round(Math.abs(secs * 1000));

    const divideBy = (time: number) => {
      return {
        quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
        remainder: msValue % time,
      };
    };

    if (value >= WEEK || (value && minSuffix === ' weeks')) {
      const {quotient, remainder} = divideBy(WEEK);
      const suffix = abbr ? t('wk') : ` ${tn('week', 'weeks', quotient)}`;

      return `${quotient}${suffix} ${
        minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)
      }`;
    }
    if (value >= DAY || (value && minSuffix === ' days')) {
      const {quotient, remainder} = divideBy(DAY);
      const suffix = abbr ? t('d') : ` ${tn('day', 'days', quotient)}`;

      return `${quotient}${suffix} ${
        minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)
      }`;
    }
    if (value >= HOUR || (value && minSuffix === ' hours')) {
      const {quotient, remainder} = divideBy(HOUR);
      const suffix = abbr ? t('hr') : ` ${tn('hour', 'hours', quotient)}`;

      return `${quotient}${suffix} ${
        minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)
      }`;
    }
    if (value >= MINUTE || (value && minSuffix === ' minutes')) {
      const {quotient, remainder} = divideBy(MINUTE);
      const suffix = abbr ? t('min') : ` ${tn('minute', 'minutes', quotient)}`;

      return `${quotient}${suffix} ${
        minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)
      }`;
    }
    if (value >= SECOND || (value && minSuffix === ' seconds')) {
      const {quotient, remainder} = divideBy(SECOND);
      const suffix = abbr ? t('s') : ` ${tn('second', 'seconds', quotient)}`;

      return `${quotient}${suffix} ${
        minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)
      }`;
    }

    if (value === 0) {
      return '';
    }

    const suffix = abbr ? t('ms') : ` ${tn('millisecond', 'milliseconds', value)}`;

    return `${msValue}${suffix}`;
  };

  const result = convertDuration(seconds, abbreviation).trim();

  if (result.length) {
    return result;
  }

  return `0${abbreviation ? SUFFIX_ABBR[precision] : minSuffix}`;
}

export const SEC_IN_WK = 604800;
export const SEC_IN_DAY = 86400;
export const SEC_IN_HR = 3600;
export const SEC_IN_MIN = 60;

type Level = [lvlSfx: moment.unitOfTime.DurationConstructor, denominator: number];

type ParsedLargestSuffix = [val: number, suffix: moment.unitOfTime.DurationConstructor];
/**
 * Given a length of time in seconds, provide me the largest divisible suffix and value for that time period.
 * eg. 60 -> [1, 'minutes']
 * eg. 7200 -> [2, 'hours']
 * eg. 7260 -> [121, 'minutes']
 *
 * @param seconds
 * @param maxSuffix     determines the largest suffix we should pin the response to
 */
export function parseLargestSuffix(
  seconds: number,
  maxSuffix: string = 'days'
): ParsedLargestSuffix {
  const levels: Level[] = [
    ['minutes', SEC_IN_MIN],
    ['hours', SEC_IN_HR],
    ['days', SEC_IN_DAY],
    ['weeks', SEC_IN_WK],
  ];
  let val = seconds;
  let suffix: moment.unitOfTime.DurationConstructor = 'seconds';
  if (val === 0) {
    return [val, suffix];
  }
  for (const [lvlSfx, denominator] of levels) {
    if (seconds % denominator) {
      break;
    }
    val = seconds / denominator;
    suffix = lvlSfx;
    if (lvlSfx === maxSuffix) {
      break;
    }
  }
  return [val, suffix];
}

export function formatSecondsToClock(
  seconds: number,
  {padAll}: {padAll: boolean} = {padAll: true}
) {
  if (seconds === 0 || isNaN(seconds)) {
    return padAll ? '00:00' : '0:00';
  }

  const divideBy = (msValue: number, time: number) => {
    return {
      quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
      remainder: msValue % time,
    };
  };

  // value in milliseconds
  const absMSValue = round(Math.abs(seconds * 1000));

  const {quotient: hours, remainder: rMins} = divideBy(absMSValue, HOUR);
  const {quotient: minutes, remainder: rSeconds} = divideBy(rMins, MINUTE);
  const {quotient: secs, remainder: milliseconds} = divideBy(rSeconds, SECOND);

  const fill = (num: number) => (num < 10 ? `0${num}` : String(num));

  const parts = hours
    ? [padAll ? fill(hours) : hours, fill(minutes), fill(secs)]
    : [padAll ? fill(minutes) : minutes, fill(secs)];

  const ms = `000${milliseconds}`.slice(-3);
  return milliseconds ? `${parts.join(':')}.${ms}` : parts.join(':');
}

export function parseClockToSeconds(clock: string) {
  const [rest, milliseconds] = clock.split('.');
  const parts = rest.split(':');

  let seconds = 0;
  const progression = [MONTH, WEEK, DAY, HOUR, MINUTE, SECOND].slice(parts.length * -1);
  for (let i = 0; i < parts.length; i++) {
    const num = Number(parts[i]) || 0;
    const time = progression[i] / 1000;
    seconds += num * time;
  }
  const ms = Number(milliseconds) || 0;
  return seconds + ms / 1000;
}

export function formatFloat(number: number, places: number) {
  const multi = Math.pow(10, places);
  return parseInt((number * multi).toString(), 10) / multi;
}

/**
 * Format a value between 0 and 1 as a percentage
 */
export function formatPercentage(value: number, places: number = 2) {
  if (value === 0) {
    return '0%';
  }
  return (
    round(value * 100, places).toLocaleString(undefined, {
      maximumFractionDigits: places,
    }) + '%'
  );
}

const numberFormats = [
  [1000000000, 'b'],
  [1000000, 'm'],
  [1000, 'k'],
] as const;

/**
 * Formats a number to a string with a suffix
 *
 * @param number the number to format
 * @param precision the number of significant digits to include
 */
export function formatAbbreviatedNumber(
  number: number | string,
  precision?: number
): string {
  number = Number(number);

  let lookup: (typeof numberFormats)[number];

  // eslint-disable-next-line no-cond-assign
  for (let i = 0; (lookup = numberFormats[i]); i++) {
    const [suffixNum, suffix] = lookup;
    const shortValue = Math.floor(number / suffixNum);
    const fitsBound = number % suffixNum;

    if (shortValue <= 0) {
      continue;
    }

    const formattedNumber =
      shortValue / 10 > 1 || !fitsBound
        ? precision === undefined
          ? shortValue
          : parseFloat(shortValue.toPrecision(precision)).toString()
        : formatFloat(number / suffixNum, precision || 1).toLocaleString(undefined, {
            maximumSignificantDigits: precision,
          });

    return `${formattedNumber}${suffix}`;
  }

  return number.toLocaleString(undefined, {maximumSignificantDigits: precision});
}

/**
 * Rounds to 2 decimal digits without forcing trailing zeros
 * Will preserve significant decimals for very small numbers
 * e.g. 0.0001234 -> 0.00012
 * @param value number to format
 */
export function formatNumberWithDynamicDecimalPoints(value: number): string {
  if ([0, Infinity, -Infinity, NaN].includes(value)) {
    return value.toLocaleString();
  }

  const exponent = Math.floor(Math.log10(value));

  const maxFractionDigits = exponent >= 0 ? 2 : Math.abs(exponent) + 1;
  const numberFormat = {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  };

  return value.toLocaleString(undefined, numberFormat);
}

export function formatRate(
  value: number,
  unit: RateUnits = RateUnits.PER_SECOND,
  options: {
    minimumValue?: number;
    significantDigits?: number;
  } = {}
) {
  // NOTE: `Intl` doesn't support unitless-per-unit formats (i.e.,
  // `"-per-minute"` is not valid) so we have to concatenate the unit manually, since our rates are usually just "/min" or "/s".
  // Because of this, the unit is not internationalized.

  // 0 is special!
  if (value === 0) {
    return `${0}${RATE_UNIT_LABELS[unit]}`;
  }

  const minimumValue = options.minimumValue ?? 0;
  const significantDigits = options.significantDigits ?? 3;

  const numberFormatOptions: ConstructorParameters<typeof Intl.NumberFormat>[1] = {
    notation: 'compact',
    compactDisplay: 'short',
    minimumSignificantDigits: significantDigits,
    maximumSignificantDigits: significantDigits,
  };

  if (value <= minimumValue) {
    return `<${minimumValue}${RATE_UNIT_LABELS[unit]}`;
  }

  return `${value.toLocaleString(undefined, numberFormatOptions)}${
    RATE_UNIT_LABELS[unit]
  }`;
}
