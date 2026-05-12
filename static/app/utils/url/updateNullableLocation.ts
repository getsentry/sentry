import type {Location} from 'history';

import {defined} from 'sentry/utils';

/**
 * Allows updating a location field, removing it if the value is null.
 *
 * Return true if the location field was updated, in case of side effects.
 */
export function updateNullableLocation(
  location: Location,
  key: string,
  value: boolean | string | string[] | null | undefined
): boolean {
  if (typeof value === 'boolean') {
    if (value) {
      location.query[key] = 'true';
    } else {
      // Delete boolean keys to minimize the number of query params.
      delete location.query[key];
    }
    return true;
  }
  if (defined(value) && location.query[key] !== value) {
    location.query[key] = value;
    return true;
  }
  if (value === null && location.query[key]) {
    delete location.query[key];
    return true;
  }
  return false;
}
