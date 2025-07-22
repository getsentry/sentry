import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/api/apiOptions';

export function useRelease({
  orgSlug,
  projectSlug,
  releaseVersion,
  enabled,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
  enabled?: boolean;
}) {
  return useQuery({
    ...apiOptions('/projects/$orgSlug/$projectSlug/releases/$releaseVersion/', {
      staleTime: Infinity,
      path: {
        orgSlug,
        projectSlug,
        releaseVersion,
      },
    }),
    enabled,
  });
}
