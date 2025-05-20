import type {ReleaseWithHealth} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useReleaseDetails(
  {release}: {release: string},
  queryOpts?: {enabled?: boolean; staleTime?: number}
) {
  const organization = useOrganization();
  return useApiQuery<ReleaseWithHealth>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}/`,
      {
        query: {},
      },
    ],
    {staleTime: Infinity, ...queryOpts}
  );
}
