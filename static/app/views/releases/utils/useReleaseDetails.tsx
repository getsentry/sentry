import type {ReleaseWithHealth} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useReleaseDetails(
  {release}: {release: string},
  queryOpts?: {enabled?: boolean; staleTime?: number}
) {
  const organization = useOrganization();
  return useApiQuery<ReleaseWithHealth>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/releases/$version/`, {
        path: {organizationIdOrSlug: organization.slug, version: release},
      }),
      {
        query: {},
      },
    ],
    {staleTime: Infinity, ...queryOpts}
  );
}
