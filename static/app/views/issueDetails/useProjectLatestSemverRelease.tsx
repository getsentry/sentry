import {ReleaseStatus, type Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useProjectLatestSemverRelease({enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const location = useLocation();

  const {data, isError, isPending} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          per_page: 1,
          sort: 'semver',
          project: location.query.project,
          environment: location.query.environment,
          status: ReleaseStatus.ACTIVE,
        },
      },
    ],
    {staleTime: 0, enabled}
  );

  if (isPending || isError || !data) {
    return undefined;
  }

  return data[0];
}
