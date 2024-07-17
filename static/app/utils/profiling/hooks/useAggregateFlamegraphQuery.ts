import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export interface AggregateFlamegraphQueryParameters {
  query: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  environments?: PageFilters['environments'];
  fingerprint?: string;
  projects?: PageFilters['projects'];
}

export type UseAggregateFlamegraphQueryResult = UseApiQueryResult<
  Profiling.Schema,
  RequestError
>;

export function useAggregateFlamegraphQuery({
  datetime,
  enabled,
  environments,
  projects,
  query,
  fingerprint,
}: AggregateFlamegraphQueryParameters): UseAggregateFlamegraphQueryResult {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = useMemo(() => {
    const params = {
      query: {
        project: projects ?? selection.projects,
        environment: environments ?? selection.environments,
        ...normalizeDateTimeParams(datetime ?? selection.datetime),
        fingerprint,
        query,
      },
    };

    return params;
  }, [datetime, environments, projects, fingerprint, query, selection]);

  return useApiQuery<Profiling.Schema>(
    [`/organizations/${organization.slug}/profiling/flamegraph/`, endpointOptions],
    {
      staleTime: 0,
      retry: false,
      enabled,
    }
  );
}
