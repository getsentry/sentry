import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function getIdFromLocation(location: Location) {
  return decodeScalar(location.query.id);
}
