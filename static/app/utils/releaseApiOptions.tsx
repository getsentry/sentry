import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function releaseApiOptions({
  orgSlug,
  projectSlug,
  releaseVersion,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
}) {
  return apiOptions.as<Release>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        version: releaseVersion,
      },
      staleTime: Infinity,
    }
  );
}
