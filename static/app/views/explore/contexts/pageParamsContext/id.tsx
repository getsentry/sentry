import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function defaultId(): undefined {
  return undefined;
}

export function getIdFromLocation(location: Location) {
  return decodeScalar(location.query.id);
}
