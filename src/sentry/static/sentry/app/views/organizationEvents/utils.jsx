import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

// Filters out params with null values and returns a default
// `statsPeriod` when necessary.
//
// Accepts `period` and `statsPeriod` but will only return `statsPeriod`
//
// TODO(billy): Make period parameter name consistent
export function getParams(params = {}) {
  const {start, end, period, statsPeriod, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  let coercedPeriod = statsPeriod || period;

  if (!start && !end && !coercedPeriod) {
    coercedPeriod = DEFAULT_STATS_PERIOD;
  }

  // Filter null values
  return Object.entries({
    statsPeriod: coercedPeriod,
    start: coercedPeriod ? null : start,
    end: coercedPeriod ? null : end,
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
