import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/api/apiOptions';
import type {Release} from 'sentry/types/release';

export function useRelease({
  organizationIdOrSlug,
  projectIdOrSlug,
  version,
  enabled,
}: {
  organizationIdOrSlug: string;
  projectIdOrSlug: string;
  version: string;
  enabled?: boolean;
}) {
  return useQuery({
    ...apiOptions.as<Release>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/',
      {
        path: {
          organizationIdOrSlug,
          projectIdOrSlug,
          version,
        },
        staleTime: Infinity,
      }
    ),
    enabled,
  });
}
