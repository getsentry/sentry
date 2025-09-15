import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

export function getSortBysFromLocation(
  location: Location,
  key: string,
  fields: string[]
): Sort[] | null {
  const sortBys = decodeSorts(location.query?.[key]);

  if (sortBys.length > 0) {
    if (sortBys.every(sort => validateSort(sort, fields))) {
      return sortBys;
    }
  }

  return null;
}

function validateSort(sort: Sort, fields: string[]) {
  return fields.includes(sort.field);
}
