import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

function defaultCursor(): string {
  return '';
}

export function getCursorFromLocation(location: Location, key: string) {
  return decodeScalar(location.query?.[key], defaultCursor());
}
