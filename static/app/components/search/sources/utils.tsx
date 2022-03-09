// Override the lint rule for this, we actually need the path lookup feature,
// which `?.` does not magically give us.
// eslint-disable-next-line no-restricted-imports
import get from 'lodash/get';

import {Fuse} from 'sentry/utils/fuzzySearch';

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
