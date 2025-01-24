import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

type Query = {
  [QueryParameterNames.SPANS_SORT]?: string;
  [QueryParameterNames.ENDPOINTS_SORT]?: string;
};

const SORTABLE_FIELDS = [
  `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
  `${SpanFunction.HTTP_ERROR_COUNT}()`,
  `${SpanFunction.SPM}()`,
  `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

/**
 * Parses a `Sort` object from the URL. In case of multiple specified sorts
 * picks the first one, since span module UIs only support one sort at a time.
 */
export function useModuleSort(
  sortParameterName: QueryParameterNames | 'sort' = 'sort',
  fallback: Sort = DEFAULT_SORT
) {
  const location = useLocation<Query>();

  return (
    // @ts-expect-error TS(2551): Property 'spansCursor' does not exist on type 'Que... Remove this comment to see the full error message
    decodeSorts(location.query[sortParameterName]).filter(isAValidSort)[0] ?? fallback
  );
}

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}
