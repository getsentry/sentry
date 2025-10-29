import type {Location} from 'history';

import {decodeQuery} from 'sentry/utils/discover/eventView';

export function defaultQuery(): string {
  return '';
}

export function getQueryFromLocation(location: Location) {
  return decodeQuery(location);
}
