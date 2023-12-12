import {fromSorts} from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DEFAULT_SORT,
  SORTABLE_FIELDS,
  SORTABLE_SCORE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

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
  const shouldUseStoredScores = useStoredScoresSetting();
  const filteredSortableFields = shouldUseStoredScores
    ? sortableFields
    : sortableFields.filter(field => !SORTABLE_SCORE_FIELDS.includes(field));

  const sort =
    fromSorts(decodeScalar(location.query[sortName])).filter(s =>
      (filteredSortableFields as unknown as string[]).includes(s.field)
    )[0] ?? defaultSort;

  return sort;
}
