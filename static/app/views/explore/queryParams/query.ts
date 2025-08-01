import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function getQueryFromLocation(location: Location, key: string) {
  return decodeScalar(location.query?.[key]);
}
