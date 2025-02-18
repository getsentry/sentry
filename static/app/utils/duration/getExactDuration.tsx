import round from 'lodash/round';

import {t, tn} from 'sentry/locale';

import {DAY, HOUR, MINUTE, SECOND, WEEK} from '../formatters';

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
 * e.g. 1 hour 25 minutes 15 seconds, -1m 50s 294ms
 */
export function getExactDuration(
  seconds: number,
  abbreviation = false,
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
        // Remainder should always be positive so that only largest unit appears negative
        remainder: Math.abs(msValue % time),
      };
    };

    if (value >= WEEK || (value && minSuffix === ' weeks')) {
      const {quotient, remainder} = divideBy(WEEK);
      const suffix = abbr ? t('wk') : ` ${tn('week', 'weeks', quotient)}`;

      return `${quotient}${suffix} ${minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= DAY || (value && minSuffix === ' days')) {
      const {quotient, remainder} = divideBy(DAY);
      const suffix = abbr ? t('d') : ` ${tn('day', 'days', quotient)}`;

      return `${quotient}${suffix} ${minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= HOUR || (value && minSuffix === ' hours')) {
      const {quotient, remainder} = divideBy(HOUR);
      const suffix = abbr ? t('hr') : ` ${tn('hour', 'hours', quotient)}`;

      return `${quotient}${suffix} ${minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MINUTE || (value && minSuffix === ' minutes')) {
      const {quotient, remainder} = divideBy(MINUTE);
      const suffix = abbr ? t('min') : ` ${tn('minute', 'minutes', quotient)}`;

      return `${quotient}${suffix} ${minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= SECOND || (value && minSuffix === ' seconds')) {
      const {quotient, remainder} = divideBy(SECOND);
      const suffix = abbr ? t('s') : ` ${tn('second', 'seconds', quotient)}`;

      return `${quotient}${suffix} ${minSuffix === suffix ? '' : convertDuration(remainder / 1000, abbr)}`;
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
