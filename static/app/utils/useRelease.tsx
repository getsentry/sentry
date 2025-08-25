import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/api/apiOptions';
import type {Release} from 'sentry/types/release';

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
    ...apiOptions.as<Release>()(
      '/projects/$orgSlug/$projectSlug/releases/$releaseVersion/',
      {
        path: {
          orgSlug,
          projectSlug,
          releaseVersion,
        },
        staleTime: Infinity,
      }
    ),
    enabled,
  });
}
