import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

export default function useProjectReleaseVersionIsSemver({
  version,
  enabled,
}: {
  enabled: boolean;
  version: string | undefined;
}) {
  const organization = useOrganization();

  const {data, isError, isPending} = useApiQuery<Release>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/', {
        path: {
          organizationIdOrSlug: organization.slug,
          version: version ?? '',
        },
      }),
    ],
    {staleTime: 0, enabled: Boolean(version) && enabled}
  );

  if (isPending || isError || !data?.versionInfo) {
    return false;
  }

  return isVersionInfoSemver(data.versionInfo.version);
}
