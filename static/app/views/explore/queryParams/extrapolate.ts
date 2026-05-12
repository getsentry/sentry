import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

/** @deprecated Use nuqs to manage query params instead. */
export function getExtrapolateFromLocation(location: Location, key: string) {
  return decodeScalar(location.query?.[key], '1') === '1';
}
