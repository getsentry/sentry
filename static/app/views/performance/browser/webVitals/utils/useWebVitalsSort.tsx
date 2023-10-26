import {fromSorts} from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DEFAULT_SORT,
  SORTABLE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';

export function useWebVitalsSort({
  sortName = 'sort',
  defaultSort = DEFAULT_SORT,
}: {
  defaultSort?: Sort;
  sortName?: string;
} = {}) {
  const location = useLocation();

  const sort =
    fromSorts(decodeScalar(location.query[sortName])).filter(s =>
      (SORTABLE_FIELDS as unknown as string[]).includes(s.field)
    )[0] ?? defaultSort;

  return sort;
}
