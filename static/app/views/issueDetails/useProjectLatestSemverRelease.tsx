import {useQuery} from '@tanstack/react-query';

import {ReleaseStatus, type Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useProjectLatestSemverRelease({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const location = useLocation();

  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        per_page: 1,
        sort: 'semver',
        project: location.query.project,
        environment: location.query.environment,
        status: ReleaseStatus.ACTIVE,
      },
      staleTime: 0,
    }),
    enabled,
  });

  if (isPending || isError || !data) {
    return undefined;
  }

  return data[0];
}
