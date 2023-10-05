import {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export function getPrimaryRelease(location: Location): string | undefined {
  const {primaryRelease} = location.query;

  return decodeScalar(primaryRelease);
}

export function getSecondaryRelease(location: Location): string | undefined {
  const {secondaryRelease} = location.query;

  return decodeScalar(secondaryRelease);
}
