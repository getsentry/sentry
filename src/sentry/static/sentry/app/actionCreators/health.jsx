const BASE_URL = org => `/organizations/${org.slug}/health/`;

// Gets the period to query with if we need to double the initial period in order
// to get data for the previous period
const getPeriod = (originalPeriod, shouldDoublePeriod) => {
  if (!shouldDoublePeriod) return originalPeriod;

  const [, periodNumber, periodLength] = originalPeriod.match(/([0-9]+)([mhdw])/);

  return `${parseInt(periodNumber, 10) * 2}${periodLength}`;
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
  const totalPeriod = getPeriod(period, shouldDoublePeriod);

  const query = {
    tag,
    includePrevious,
    interval,
    statsPeriod: totalPeriod,
    project: projects,
    environment: environments,
    q: specifiers,
    limit,
    ...(topk ? {topk} : {}),
  };

  return api.requestPromise(`${BASE_URL(organization)}${path}`, {
    query,
  });
};
