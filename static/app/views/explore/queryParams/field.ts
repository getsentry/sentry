import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';

export function getFieldsFromLocation(location: Location, key: string): string[] | null {
  const fields = decodeList(location.query?.[key]);

  if (fields.length) {
    return fields;
  }

  return null;
}
