import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

const getUtcValue = utc => {
  if (typeof utc !== 'undefined') {
    return utc === true || utc === 'true' ? 'true' : 'false';
  }

  return utc;
};

// Filters out params with null values and returns a default
// `statsPeriod` when necessary.
//
// Accepts `period` and `statsPeriod` but will only return `statsPeriod`
//
// TODO(billy): Make period parameter name consistent
export function getParams(params = {}) {
  let {start, end, period, statsPeriod, utc, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  period = statsPeriod || period;

  if (!start && !end && !period) {
    period = DEFAULT_STATS_PERIOD;
  }

  // Filter null values
  return Object.entries({
    statsPeriod: period,
    start: period ? null : start,
    end: period ? null : end,
    // coerce utc into a string (it can be both: a string representation from router,
    // or a boolean from time range picker)
    utc: getUtcValue(utc),
    ...otherParams,
  })
    .filter(([key, value]) => defined(value))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }),
      {}
    );
}
