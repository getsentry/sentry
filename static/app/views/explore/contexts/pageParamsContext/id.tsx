import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';

export function defaultId(): undefined {
  return undefined;
}

export function getIdFromLocation(location: Location) {
  return decodeScalar(location.query.id);
}

export function updateLocationWithId(location: Location, id: string | null | undefined) {
  if (defined(id)) {
    location.query.id = id;
  } else if (id === null) {
    delete location.query.id;
  }
}
