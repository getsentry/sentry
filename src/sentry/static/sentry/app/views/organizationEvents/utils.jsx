import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

// Filters out params with null values and returns a default
// `statsPeriod` when necessary.
//
// Accepts `period` and `statsPeriod` but will only return `statsPeriod`
//
// TODO(billy): Make period parameter name consistent
export function getParams(params = {}) {
  let {start, end, period, statsPeriod, ...otherParams} = params;

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
