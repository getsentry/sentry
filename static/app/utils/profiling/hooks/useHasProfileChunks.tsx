import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {UseQueryResult} from 'sentry/utils/queryClient';
import {useQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useHasProfilingChunks(): UseQueryResult<boolean, RequestError> {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return useQuery({
    queryKey: [`/organizations/${organization.slug}/profiling/has-chunks/`],
    queryFn: () =>
      api
        .requestPromise(`/organizations/${organization.slug}/profiling/has-chunks/`, {
          query: {
            project: selection.projects,
            environment: selection.environments,
            ...normalizeDateTimeParams(selection.datetime),
          },
        })
        .then((res: {hasChunks: boolean}) => res.hasChunks),
    staleTime: 0,
  });
}
