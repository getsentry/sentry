import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Query = {
  [QueryParameterNames.SORT]: string;
};

const SORTABLE_FIELDS = [
  `avg(${SpanMetricsFields.SPAN_SELF_TIME})`,
  `${StarfishFunctions.HTTP_ERROR_COUNT}()`,
  `${StarfishFunctions.SPM}()`,
  `${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`,
  `${StarfishFunctions.TIME_SPENT_PERCENTAGE}(local)`,
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function useModuleSort() {
  const location = useLocation<Query>();

  return (
    fromSorts(location.query[QueryParameterNames.SORT]).filter(isAValidSort)[0] ??
    DEFAULT_SORT
  ); // We only allow one sort on this table in this view
}

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage()',
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}
