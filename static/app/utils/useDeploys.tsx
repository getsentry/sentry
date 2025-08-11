import type {Deploy} from 'sentry/types/release';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

function getDeploysQueryKey({
  orgSlug,
  releaseVersion,
}: {
  orgSlug: string;
  releaseVersion: string;
}): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/releases/${encodeURIComponent(releaseVersion)}/deploys/`,
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
