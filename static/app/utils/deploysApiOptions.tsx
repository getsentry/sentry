import type {Deploy} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function deploysApiOptions({
  orgSlug,
  releaseVersion,
  query,
}: {
  orgSlug: string;
  releaseVersion: string;
  query?: Record<'project', unknown>;
}) {
  return apiOptions.as<Deploy[]>()(
    '/organizations/$organizationIdOrSlug/releases/$version/deploys/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        version: releaseVersion,
      },
      query,
      staleTime: Infinity,
    }
  );
}
