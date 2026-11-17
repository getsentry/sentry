import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

export function getSortBys(
  rawSortBys: readonly string[],
  fields: string[]
): Sort[] | null {
  const sortBys = decodeSorts([...rawSortBys]);

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
