import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;
const {TIME_SPENT_PERCENTAGE} = SpanFunction;

type Query = {
  sort?: string;
};

const SORTABLE_FIELDS = [
  `avg(${SPAN_SELF_TIME})`,
  SPAN_DESCRIPTION,
  'spm()',
  `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
  `${TIME_SPENT_PERCENTAGE}()`,
] as const;

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
  field: SORTABLE_FIELDS[4],
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}
