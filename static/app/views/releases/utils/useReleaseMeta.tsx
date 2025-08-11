import type {ReleaseMeta} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useReleaseMeta({release}: {release: string}) {
  const organization = useOrganization();
  return useApiQuery<ReleaseMeta>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}/meta/`,
      {
        query: {},
      },
    ],
    {staleTime: 0}
  );
}
