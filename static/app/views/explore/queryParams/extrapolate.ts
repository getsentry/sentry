import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function getExtrapolateFromLocation(location: Location, key: string) {
  return decodeScalar(location.query?.[key], '1') === '1';
}
