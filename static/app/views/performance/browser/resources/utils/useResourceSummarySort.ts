import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import type {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const {HTTP_RESPONSE_CONTENT_LENGTH, SPAN_SELF_TIME} = SpanMetricsField;

type Query = {
  sort?: string;
};

const SORTABLE_FIELDS = [
  `avg(${SPAN_SELF_TIME})`,
  'spm()',
  `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

/**
 * Parses a `Sort` object from the URL. In case of multiple specified sorts
 * picks the first one, since span module UIs only support one sort at a time.
 */
export function useResourceSummarySort(
  sortParameterName: QueryParameterNames | 'sort' = 'sort',
  fallback: Sort = DEFAULT_SORT
) {
  const location = useLocation<Query>();

  return (
    decodeSorts(location.query[sortParameterName]).filter(isAValidSort)[0] ?? fallback
  );
}

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: SORTABLE_FIELDS[1],
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}
