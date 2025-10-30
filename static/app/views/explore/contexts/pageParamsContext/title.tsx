import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function getTitleFromLocation(location: Location) {
  return decodeScalar(location.query.title);
}
