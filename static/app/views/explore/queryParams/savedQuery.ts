import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export const ID_KEY = 'id';
export const TITLE_KEY = 'title';

export function getIdFromLocation(location: Location, key: string): string | undefined {
  return decodeScalar(location.query?.[key]);
}

export function getTitleFromLocation(
  location: Location,
  key: string
): string | undefined {
  return decodeScalar(location.query?.[key]);
}
