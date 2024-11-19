import type {Release} from 'sentry/types/release';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

function getReleaseQueryKey({
  orgSlug,
  projectSlug,
  releaseVersion,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
}): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(releaseVersion)}/`,
  ];
}

export function useRelease({
  orgSlug,
  projectSlug,
  releaseVersion,
}: {
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
}) {
  return useApiQuery<Release>(
    getReleaseQueryKey({orgSlug, projectSlug, releaseVersion}),
    {
      staleTime: Infinity,
    }
  );
}
