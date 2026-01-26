import type {Deploy} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';

function getDeploysQueryKey({
  orgSlug,
  releaseVersion,
}: {
  orgSlug: string;
  releaseVersion: string;
}): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/deploys/', {
      path: {
        organizationIdOrSlug: orgSlug,
        version: releaseVersion,
      },
    }),
  ];
}

export function useDeploys({
  orgSlug,
  releaseVersion,
}: {
  orgSlug: string;
  releaseVersion: string;
}) {
  return useApiQuery<Deploy[]>(getDeploysQueryKey({orgSlug, releaseVersion}), {
    staleTime: Infinity,
  });
}
