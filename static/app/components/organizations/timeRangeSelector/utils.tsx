import moment from 'moment';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

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
  outputFormat: string | null = DATE_TIME_FORMAT
): {end: string; start: string} {
  const statsPeriodRegex = /^(\d+)([smhd]{1})$/;

  const result = statsPeriodRegex.exec(statsPeriod);

  if (result === null) {
    throw new Error('Invalid stats period');
  }

  const value = parseInt(result[1], 10);
  const unit = {
    d: 'days',
    h: 'hours',
    s: 'seconds',
    m: 'minutes',
  }[result[2]] as 'days' | 'hours' | 'seconds' | 'minutes';

  const format = outputFormat === null ? undefined : outputFormat;
  return {
    start: moment().subtract(value, unit).format(format),
    end: moment().format(format),
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
  const defaultRelativePeriodString =
    relativeOptions?.[relative] ?? DEFAULT_RELATIVE_PERIODS[relative];

  if (!defaultRelativePeriodString) {
    try {
      parseStatsPeriod(relative);
      return t('Other');
    } catch (err) {
      return 'Invalid period';
    }
  }

  return defaultRelativePeriodString;
}
