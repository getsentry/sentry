import type {ReleaseMeta} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const RELEASE_META_STALE_TIME_MS = 2 * 60 * 1000; // cache for 2 minutes

export function useReleaseMeta({release}: {release: string}) {
  const organization = useOrganization();
  return useApiQuery<ReleaseMeta>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}/meta/`,
      {
        query: {},
      },
    ],
    {staleTime: RELEASE_META_STALE_TIME_MS}
  );
}
