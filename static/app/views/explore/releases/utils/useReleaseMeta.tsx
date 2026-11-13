import {useQuery} from '@tanstack/react-query';

import type {ReleaseMeta} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useReleaseMeta({release}: {release: string}) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<ReleaseMeta>()(
      '/organizations/$organizationIdOrSlug/releases/$version/meta/',
      {
        path: {organizationIdOrSlug: organization.slug, version: release},
        query: {},
        staleTime: 0,
      }
    )
  );
}
