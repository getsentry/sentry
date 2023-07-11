import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useAggregateFlamegraphQuery({transaction}: {transaction: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/profiling/flamegraph/`;

  const query = useMemo(() => {
    // TODO: this should contain the user query
    // wait util we fully switch over to the transactions dataset
    const conditions = new MutableSearch([]);
    conditions.setFilterValues('transaction', [transaction]);
    return conditions.formatString();
  }, [transaction]);

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      query,
    },
  };

  return useApiQuery<Profiling.Schema>([path, endpointOptions], {
    staleTime: 0,
    retry: false,
  });
}
