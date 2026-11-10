import {useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';

import {apiOptions} from './api/apiOptions';

function getReleaseRepositoriesApiOptions({
  orgSlug,
  projectSlug,
  release,
}: {
  orgSlug: string;
  projectSlug: string;
  release: string;
}) {
  return apiOptions.as<Repository[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/repositories/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        version: release,
      },
      staleTime: Infinity,
    }
  );
}

interface UseReleaseReposProps {
  orgSlug: string;
  projectSlug: string;
  release: string;
  options?: {enabled?: boolean};
}

export function useReleaseRepositories({
  orgSlug,
  projectSlug,
  release,
  options,
}: UseReleaseReposProps) {
  return useQuery({
    ...getReleaseRepositoriesApiOptions({
      orgSlug,
      projectSlug,
      release,
    }),
    ...options,
  });
}
