import {getApiUrl} from 'sentry/api/getApiUrl';
import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';

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
  return useApiQuery<Release>(
    [
      getApiUrl('/projects/$orgSlug/$projectSlug/releases/$releaseVersion/', {
        path: {
          orgSlug,
          projectSlug,
          releaseVersion,
        },
      }),
    ],
    {
      enabled,
      staleTime: Infinity,
    }
  );
}
