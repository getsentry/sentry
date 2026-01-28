import type {Repository} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';

function getRepositoriesQueryKey({orgSlug}: {orgSlug: string}): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ];
}

export function useRepositories({orgSlug}: {orgSlug: string}) {
  return useApiQuery<Repository[]>(getRepositoriesQueryKey({orgSlug}), {
    staleTime: Infinity,
  });
}
