import round from 'lodash/round';

import {t, tn} from 'sentry/locale';
import {DAY, HOUR, MINUTE, SECOND, WEEK} from 'sentry/utils/formatters';

/**
 * Returns a human readable exact duration.
 *
 * e.g. 1 hour 25 minutes 15 seconds
 */

export default function getExactDuration(seconds: number, abbreviation: boolean = false) {
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

    if (value >= WEEK) {
      const {quotient, remainder} = divideBy(WEEK);
      const suffix = abbr ? t('wk') : ` ${tn('week', 'weeks', quotient)}`;

      return `${quotient}${suffix} ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= DAY) {
      const {quotient, remainder} = divideBy(DAY);
      const suffix = abbr ? t('d') : ` ${tn('day', 'days', quotient)}`;

      return `${quotient}${suffix} ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= HOUR) {
      const {quotient, remainder} = divideBy(HOUR);
      const suffix = abbr ? t('hr') : ` ${tn('hour', 'hours', quotient)}`;

      return `${quotient}${suffix} ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MINUTE) {
      const {quotient, remainder} = divideBy(MINUTE);
      const suffix = abbr ? t('min') : ` ${tn('minute', 'minutes', quotient)}`;

      return `${quotient}${suffix} ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= SECOND) {
      const {quotient, remainder} = divideBy(SECOND);
      const suffix = abbr ? t('s') : ` ${tn('second', 'seconds', quotient)}`;

      return `${quotient}${suffix} ${convertDuration(remainder / 1000, abbr)}`;
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

  return `0${abbreviation ? t('ms') : ` ${t('milliseconds')}`}`;
}
