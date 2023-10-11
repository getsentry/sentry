import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Query = {
  sort?: string;
};

const SORTABLE_FIELDS = ['avg(span.self_time)', 'span.description', 'spm()'] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

/**
 * Parses a `Sort` object from the URL. In case of multiple specified sorts
 * picks the first one, since span module UIs only support one sort at a time.
 */
export function useResourceSort(
  sortParameterName: QueryParameterNames | 'sort' = 'sort',
  fallback: Sort = DEFAULT_SORT
) {
  const location = useLocation<Query>();

  return fromSorts(location.query[sortParameterName]).filter(isAValidSort)[0] ?? fallback;
}

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: SORTABLE_FIELDS[0],
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}
