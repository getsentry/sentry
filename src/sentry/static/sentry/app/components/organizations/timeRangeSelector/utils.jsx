import moment from 'moment';

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

/**
 * Converts a relative stats period, e.g. `1h` to an object containing a start
 * and end date, with the end date as the current time and the start date as the
 * time that is the current time less the statsPeriod.
 *
 * @param {String} val Relative stats period
 * @returns {Object} Object containing start and end date as YYYY-MM-DDTHH:mm:ss
 *
 */
export function parseStatsPeriod(statsPeriod) {
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
  }[result[2]];

  return {
    start: moment()
      .subtract(value, unit)
      .format(DATE_TIME_FORMAT),
    end: moment().format(DATE_TIME_FORMAT),
  };
}
