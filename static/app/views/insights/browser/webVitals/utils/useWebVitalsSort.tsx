import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DEFAULT_SORT,
  SORTABLE_FIELDS,
} from 'sentry/views/insights/browser/webVitals/types';

export function useWebVitalsSort({
  sortName = 'sort',
  defaultSort = DEFAULT_SORT,
  sortableFields = SORTABLE_FIELDS as unknown as string[],
}: {
  defaultSort?: Sort;
  sortName?: string;
  sortableFields?: string[];
} = {}) {
  const location = useLocation();
  const filteredSortableFields = sortableFields;

  const sort =
    decodeSorts(location.query[sortName]).filter(s =>
      filteredSortableFields.includes(s.field)
    )[0] ?? defaultSort;

  return sort;
}
