import type {Deploy} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function deployApiOptions({
  orgSlug,
  releaseVersion,
}: {
  orgSlug: string;
  releaseVersion: string;
}) {
  return apiOptions.as<Deploy[]>()(
    '/organizations/$organizationIdOrSlug/releases/$version/deploys/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        version: releaseVersion,
      },
      staleTime: Infinity,
    }
  );
}
