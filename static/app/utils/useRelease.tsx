import {useQuery} from '@tanstack/react-query';

import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';

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
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          version: releaseVersion,
        },
        staleTime: Infinity,
      }
    ),
    enabled,
  });
}
