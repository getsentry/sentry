import {t, tn} from 'sentry/locale';

import {DAY, HOUR, MINUTE, MONTH, SECOND, WEEK} from '../formatters';

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

export default function getDuration(
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
    return `${label}${abbreviation ? DURATION_LABELS.mo : ` ${tn('month', 'months', result)}`}`;
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
