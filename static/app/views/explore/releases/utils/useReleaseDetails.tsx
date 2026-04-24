import {useQuery} from '@tanstack/react-query';

import type {ReleaseWithHealth} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useReleaseDetails({release}: {release: string}) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<ReleaseWithHealth>()(
      '/organizations/$organizationIdOrSlug/releases/$version/',
      {
        path: {organizationIdOrSlug: organization.slug, version: release},
        staleTime: Infinity,
      }
    )
  );
}
