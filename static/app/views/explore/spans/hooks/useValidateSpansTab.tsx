import {useQuery, skipToken} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsQuery,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getColumnFieldsForValidation} from 'sentry/views/explore/utils/columnValidation';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

type UseValidateSpansTabArgs = {
  enabled?: boolean;
};

export function useValidateSpansTab({enabled = true}: UseValidateSpansTabArgs = {}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const query = useQueryParamsQuery();
  const aggregateFields = useQueryParamsAggregateFields();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const [tab] = useTab();
  const shouldValidateColumns = tab === Tab.SPAN || tab === Mode.AGGREGATE;

  const {data, error, isFetching, isLoading, isPlaceholderData} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.SPANS,
      environments: selection.environments,
      field: shouldValidateColumns
        ? getColumnFieldsForValidation({aggregateFields, fields})
        : undefined,
      orderBy: shouldValidateColumns
        ? [...sortBys, ...aggregateSortBys].map(sortBy =>
            sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
          )
        : undefined,
      query,
      projectIds: selection.projects,
    }),
    // using skipToken is the new preferred way to skip a query
    ...(enabled ? {} : {queryFn: skipToken}),
  });

  return {
    data,
    error,
    isFetching,
    isPlaceholderData,
    isLoading,
  };
}
