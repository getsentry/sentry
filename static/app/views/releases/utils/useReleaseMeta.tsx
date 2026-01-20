import type {ReleaseMeta} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useReleaseMeta({release}: {release: string}) {
  const organization = useOrganization();
  return useApiQuery<ReleaseMeta>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/releases/$version/meta/`, {
        path: {organizationIdOrSlug: organization.slug, version: release},
      }),
      {
        query: {},
      },
    ],
    {staleTime: 0}
  );
}
