import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {getUtcDateString} from 'app/utils/dates';

const BASE_URL = org => `/organizations/${org.slug}/health/`;

// Gets the period to query with if we need to double the initial period in order
// to get data for the previous period
const getPeriod = ({period, start, end}, {shouldDoublePeriod}) => {
  if (!period && !start && !end) {
    period = DEFAULT_STATS_PERIOD;
  }

  // you can not specify both relative and absolute periods
  // relative period takes precendence
  if (period) {
    if (!shouldDoublePeriod) return {statsPeriod: period};
    const [, periodNumber, periodLength] = period.match(/([0-9]+)([mhdw])/);

    return {statsPeriod: `${parseInt(periodNumber, 10) * 2}${periodLength}`};
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment(end).diff(moment(start));

    return {
      start: getUtcDateString(moment(start).subtract(diff)),
      end: getUtcDateString(end),
    };
  }

  return {start, end};
};

/**
 * Make requests to `health` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.projects List of project ids
 * @param {String} options.tag The "tag" to query for
 * @param {Boolean} options.timeseries Should we group results by time period
 * @param {String[]} options.environments List of environments to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {Number} options.topk Include topk results
 */
export const doHealthRequest = (
  api,
  {
    organization,
    projects,
    tag,
    environments,
    period,
    start,
    end,
    interval,
    timeseries,
    includePrevious,
    topk,
    specifiers,
    limit,
  }
) => {
  if (!api) return Promise.reject(new Error('API client not available'));

  const path = timeseries ? 'graph/' : 'top/';
  const shouldDoublePeriod = timeseries && includePrevious;
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  const query = {
    tag,
    includePrevious,
    interval,
    project: projects,
    environment: environments,
    q: specifiers,
    limit,
    ...periodObj,
    ...(topk ? {topk} : {}),
  };

  return api.requestPromise(`${BASE_URL(organization)}${path}`, {
    query,
  });
};
