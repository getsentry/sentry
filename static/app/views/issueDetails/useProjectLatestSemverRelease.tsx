import {useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {ReleaseStatus, type Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useProjectLatestSemverRelease({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const [{project, environment}] = useQueryStates(pageFilterParsers);

  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        per_page: 1,
        sort: 'semver',
        project,
        environment,
        status: ReleaseStatus.ACTIVE,
      },
      staleTime: 0,
    }),
    enabled,
  });

  if (isPending || isError || !data) {
    return;
  }

  return data[0];
}
