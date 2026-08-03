import {skipToken, useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getColumnFieldsForValidation} from 'sentry/views/explore/utils/columnValidation';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

type UseValidateLogsTabArgs = {
  enabled?: boolean;
};

export function useValidateLogsTab({enabled = true}: UseValidateLogsTabArgs = {}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const search = useQueryParamsSearch();
  const aggregateFields = useQueryParamsAggregateFields();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const {data, isFetching, isLoading} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.LOGS,
      environments: selection.environments,
      field: getColumnFieldsForValidation({aggregateFields, fields}),
      orderBy: [...sortBys, ...aggregateSortBys].map(sortBy =>
        sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
      ),
      query: search.formatString(),
      projectIds: selection.projects,
    }),
    // using skipToken is the new preferred way to skip a query
    ...(enabled ? {} : {queryFn: skipToken}),
  });

  return {
    data,
    isFetching,
    isLoading,
  };
}
