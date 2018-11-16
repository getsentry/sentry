import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {getUtcDateString} from 'app/utils/dates';

const BASE_URL = org => `/organizations/${org.slug}/events-stats/`;

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

  const formattedStart = getUtcDateString(start);
  const formattedEnd = getUtcDateString(end);

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment(end).diff(moment(start));

    const previousPeriodStart = moment(start).subtract(diff);

    return [
      {
        start: getUtcDateString(previousPeriodStart),
        end: formattedStart,
      },
      {
        start: formattedStart,
        end: formattedEnd,
      },
    ];
  }

  return {
    start: formattedStart,
    end: formattedEnd,
  };
};

/**
 * Make requests to `health` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.projects List of project ids
 * @param {String[]} options.environments List of environments to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 */
export const doEventsRequest = (
  api,
  {
    organization,
    projects,
    environments,
    period,
    start,
    end,
    interval,
    includePrevious,
    limit,
    query,
  }
) => {
  if (!api) return Promise.reject(new Error('API client not available'));

  const shouldDoublePeriod = includePrevious;
  const urlQuery = {
    interval,
    project: projects,
    environment: environments,
    query,
  };

  // Need to treat absolute dates differently, need to perform 2 requests in
  // order to guarantee a previous period that matches up to current period
  if (period || !shouldDoublePeriod) {
    const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

    return api.requestPromise(`${BASE_URL(organization)}`, {
      query: {
        ...urlQuery,
        ...periodObj,
      },
    });
  }

  const absolutePeriods = getPeriod({start, end}, {shouldDoublePeriod});

  return Promise.all(
    absolutePeriods.filter(i => !!i).map(absolutePeriod =>
      api.requestPromise(`${BASE_URL(organization)}`, {
        query: {
          ...urlQuery,
          ...absolutePeriod,
        },
      })
    )
  ).then(results => ({
    data: results.reduce((acc, {data}) => acc.concat(data), []),
  }));
};
