import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {getUtcDateString} from 'app/utils/dates';

/**
 * Gets the period to query with if we need to double the initial period in order
 * to get data for the previous period
 *
 * @param {Object} dateObj The date object
 * @param {String} dateObj.period Relative period string in format "<int><unit>" (e.g. 4d for 4 days)
 * @param {Date} dateObj.start Starting date object
 * @param {Date} dateObj.end Ending date object
 * @param {Object} options Options
 * @param {Boolean} [options.shouldDoublePeriod] Doubles the given period (useful for getting previous period data)
 * @return {Object} Returns an object with either a period or start/end dates ({statsPeriod: string} or {start: string, end: string})
 */
type Options = {shouldDoublePeriod?: boolean};

export const getPeriod = (
  {period, start, end},
  {shouldDoublePeriod}: Options = {}
): {start: string; end: string} | {statsPeriod: string} => {
  if (!period && !start && !end) {
    period = DEFAULT_STATS_PERIOD;
  }

  // you can not specify both relative and absolute periods
  // relative period takes precedence
  if (period) {
    if (!shouldDoublePeriod) {
      return {statsPeriod: period};
    }
    const [, periodNumber, periodLength] = period.match(/([0-9]+)([mhdw])/);

    return {statsPeriod: `${parseInt(periodNumber, 10) * 2}${periodLength}`};
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  const formattedStart = getUtcDateString(start);
  const formattedEnd = getUtcDateString(end);

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment(end).diff(moment(start));

    const previousPeriodStart = moment(start).subtract(diff);

    // This is not as accurate as having 2 start/end objs
    return {
      start: getUtcDateString(previousPeriodStart),
      end: formattedEnd,
    };
  }

  return {
    start: formattedStart,
    end: formattedEnd,
  };
};
