import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters} from 'sentry/types';
import {useApiQuery, UseApiQueryResult} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

export type AggregateFlamegraphQueryParameters = {
  datetime: Partial<PageFilters['datetime']>;
  environments: string[];
  projects: number[];
  transaction: string;
};

export type UseAggregateFlamegraphQueryResult = UseApiQueryResult<
  Profiling.Schema,
  RequestError
>;

export function useAggregateFlamegraphQuery({
  projects,
  datetime,
  environments,
  transaction,
}: AggregateFlamegraphQueryParameters): UseAggregateFlamegraphQueryResult {
  const organization = useOrganization();

  const query = useMemo(() => {
    // TODO: this should contain the user query
    // wait util we fully switch over to the transactions dataset
    const conditions = new MutableSearch([]);
    conditions.setFilterValues('transaction', [transaction]);
    return conditions.formatString();
  }, [transaction]);

  const enabled = !!transaction && Array.isArray(projects) && projects.length > 0;

  const endpointOptions = {
    query: {
      project: projects,
      environment: environments,
      ...normalizeDateTimeParams(datetime),
      query,
    },
  };

  return useApiQuery<Profiling.Schema>(
    [`/organizations/${organization.slug}/profiling/flamegraph/`, endpointOptions],
    {
      staleTime: 0,
      retry: false,
      enabled,
    }
  );
}
