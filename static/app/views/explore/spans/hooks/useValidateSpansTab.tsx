import {useQuery, skipToken} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsAggregateFields,
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
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const {data, isFetching, isLoading, isPlaceholderData} = useQuery({
    ...validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.SPANS,
      environments: selection.environments,
      field: getColumnFieldsForValidation({aggregateFields, fields}),
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
