import type {Repository} from 'sentry/types/integrations';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

function getRepositoriesQueryKey({orgSlug}: {orgSlug: string}): ApiQueryKey {
  return [`/organizations/${orgSlug}/repos/`];
}

export function useRepositories({orgSlug}: {orgSlug: string}) {
  return useApiQuery<Repository[]>(getRepositoriesQueryKey({orgSlug}), {
    staleTime: Infinity,
  });
}
