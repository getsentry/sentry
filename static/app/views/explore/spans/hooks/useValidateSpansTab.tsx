import {useQuery, skipToken} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {parseFunction} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsAggregateFields,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

type UseValidateSpansTabArgs = {
  enabled?: boolean;
};

export function useValidateSpansTab({enabled = true}: UseValidateSpansTabArgs = {}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const query = useQueryParamsQuery();
  const aggregateFields = useQueryParamsAggregateFields();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();

  const {data, isFetching, isLoading, isPlaceholderData} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.SPANS,
      environments: selection.environments,
      field: Array.from(
        new Set([
          ...fields,
          ...groupBys.filter(g => g !== ''),
          ...visualizes.map(v => v.yAxis),
          ...aggregateFields.flatMap(aggregateField => {
            if ('groupBy' in aggregateField) {
              return aggregateField.groupBy ? [aggregateField.groupBy] : [];
            }
            return [
              aggregateField.yAxis,
              ...(parseFunction(aggregateField.yAxis)?.arguments.filter(Boolean) ?? []),
            ];
          }),
        ])
      ),
      orderBy: sortBys.map(s => (s.kind === 'desc' ? `-${s.field}` : s.field)),
      query,
      projectIds: selection.projects,
    }),
    // using skipToken is the new preferred way to skip a query
    ...(enabled ? {} : {queryFn: skipToken}),
  });

  return {
    data,
    isFetching,
    isPlaceholderData,
    isLoading,
  };
}
