import {t, tn} from 'sentry/locale';

import {
  DAY,
  HOUR,
  MICROSECOND,
  MILLISECOND,
  MINUTE,
  MONTH,
  SECOND,
  WEEK,
  YEAR,
} from '../formatters';

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

/**
 * Returns a human redable duration rounded to the largest unit.
 *
 * e.g. 2 days, or 3 months, or 25 seoconds
 *
 * Use `getExactDuration` for exact durations
 */
const DURATION_LABELS = {
  y: t('y'),
  yr: t('yr'),
  year: t('year'),
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
  us: 'μs', // SI units don't need a translation
  microsecond: t('microsecond'),
  microseconds: t('microseconds'),
};

/**
 *
 * @param seconds Duration in seconds
 * @param fixedDigits Number of digits after the decimal in output format
 * @param abbreviation Use short-ish labels like "sec" for "second" and "wk" for "week" if available
 * @param extraShort Use extra-short labels like "s" for "second" and "w" for week
 * @param absolute Convert the number of second to absolute before formatting
 * @param minimumUnit Smallest unit to consider while formatting. 55 seconds with a `minimumUnit` of `MINUTE` will return `"1 minute"` instead of `"55 seconds"`
 * @returns Formatted string
 */
export default function getDuration(
  seconds: number,
  fixedDigits = 0,
  abbreviation = false,
  extraShort = false,
  absolute = false,
  minimumUnit: number = MILLISECOND
): string {
  const absValue = Math.abs(seconds * 1000);

  // value in milliseconds
  const msValue = absolute ? absValue : seconds * 1000;

  if (absValue >= YEAR || minimumUnit === YEAR) {
    const {label, result} = roundWithFixed(msValue / YEAR, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.y}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.yr}`;
    }
    return `${label}${abbreviation ? DURATION_LABELS.yr : ` ${tn('year', 'years', result)}`}`;
  }

  if (absValue >= MONTH || minimumUnit === MONTH) {
    const {label, result} = roundWithFixed(msValue / MONTH, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.m}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.mo}`;
    }
    return `${label}${abbreviation ? DURATION_LABELS.mo : ` ${tn('month', 'months', result)}`}`;
  }

  if (absValue >= WEEK || minimumUnit === WEEK) {
    const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.w}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.wk}`;
    }
    return `${label} ${tn('week', 'weeks', result)}`;
  }

  if (absValue >= DAY || minimumUnit === DAY) {
    const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);

    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.d}`;
    }
    return `${label} ${tn('day', 'days', result)}`;
  }

  if (absValue >= HOUR || minimumUnit === HOUR) {
    const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.h}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.hr}`;
    }
    return `${label} ${tn('hour', 'hours', result)}`;
  }

  if (absValue >= MINUTE || minimumUnit === MINUTE) {
    const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
    if (extraShort) {
      return `${label}${DURATION_LABELS.m}`;
    }
    if (abbreviation) {
      return `${label}${DURATION_LABELS.min}`;
    }
    return `${label} ${tn('minute', 'minutes', result)}`;
  }

  if (absValue >= SECOND || minimumUnit === SECOND) {
    const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.s}`;
    }
    return `${label} ${tn('second', 'seconds', result)}`;
  }

  if (absValue >= MILLISECOND || minimumUnit === MILLISECOND) {
    const {label, result} = roundWithFixed(msValue / MILLISECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${DURATION_LABELS.ms}`;
    }
    return `${label} ${tn('millisecond', 'milliseconds', result)}`;
  }

  const {label, result} = roundWithFixed(msValue / MICROSECOND, fixedDigits);

  if (extraShort || abbreviation) {
    return `${label}${DURATION_LABELS.us}`;
  }

  return `${label} ${tn('microsecond', 'microseconds', result)}`;
}
