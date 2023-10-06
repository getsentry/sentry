import {t, tn} from 'sentry/locale';

import {DAY, HOUR, MINUTE, MONTH, roundWithFixed, SECOND, WEEK} from '../formatters';

/**
 * Returns a human redable duration rounded to the largest unit.
 *
 * e.g. 2 days, or 3 months, or 25 seoconds
 *
 * Use `getExactDuration` for exact durations
 */

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
    return `${label}${abbreviation ? t('mo') : ` ${tn('month', 'months', result)}`}`;
  }

  if (absValue >= WEEK) {
    const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
    if (extraShort) {
      return `${label}${t('w')}`;
    }
    if (abbreviation) {
      return `${label}${t('wk')}`;
    }
    return `${label} ${tn('week', 'weeks', result)}`;
  }

  if (absValue >= DAY) {
    const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);

    if (extraShort || abbreviation) {
      return `${label}${t('d')}`;
    }
    return `${label} ${tn('day', 'days', result)}`;
  }

  if (absValue >= HOUR) {
    const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
    if (extraShort) {
      return `${label}${t('h')}`;
    }
    if (abbreviation) {
      return `${label}${t('hr')}`;
    }
    return `${label} ${tn('hour', 'hours', result)}`;
  }

  if (absValue >= MINUTE) {
    const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
    if (extraShort) {
      return `${label}${t('m')}`;
    }
    if (abbreviation) {
      return `${label}${t('min')}`;
    }
    return `${label} ${tn('minute', 'minutes', result)}`;
  }

  if (absValue >= SECOND) {
    const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${t('s')}`;
    }
    return `${label} ${tn('second', 'seconds', result)}`;
  }

  const {label, result} = roundWithFixed(msValue, fixedDigits);

  if (extraShort || abbreviation) {
    return `${label}${t('ms')}`;
  }

  return `${label} ${tn('millisecond', 'milliseconds', result)}`;
}
