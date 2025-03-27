import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {fetchDataQuery, useQuery, type UseQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useHasProfilingChunks(): UseQueryResult<boolean, RequestError> {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const queryParams = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  };

  return useQuery({
    queryKey: [
      `/organizations/${organization.slug}/profiling/has-chunks/`,
      queryParams,
    ] as const,
    queryFn: context =>
      fetchDataQuery<{hasChunks: boolean}>(context).then(res => res[0].hasChunks),
    staleTime: 0,
  });
}
