// Override the lint rule for this, we actually need the path lookup feature,
// which `?.` does not magically give us.
// eslint-disable-next-line no-restricted-imports
import get from 'lodash/get';

import type {Fuse} from 'sentry/utils/fuzzySearch';

/**
 * A value getter for fuse that will ensure the result is a string.
 *
 * This is useful since we sometimes will pass in react nodes, which fuse will
 * not index.
 */
export const strGetFn: Fuse.FuseGetFunction<any> = (value, path) => {
  const valueAtPath = get(value, path);
  return typeof valueAtPath === 'string' ? valueAtPath : '';
};

/**
 * We compute a `resolvedTs` for each result in the search sources. This value
 * is used to sort results such that results that resolve later do not get
 * sorted above results that resolved quicker.
 *
 * This threshold is used to ensure that results that resolve in a similar time
 * to other sources do not end up having their sorting penalized just because
 * they resolved ever so slightly slower.
 *
 * We set this to a number around the "typical human reaction time" which we've
 * decided here to be 250ms. This seems to "feel" right in terms of the results
 * not jumping around too much, while still maintaining a good score-sorted
 * ordering.
 */
const RESOLVED_TS_THRESHOLD = 250;

export const makeResolvedTs = () => Math.round(Date.now() / RESOLVED_TS_THRESHOLD);
