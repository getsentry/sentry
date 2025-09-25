import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

export default function useProjectReleaseVersionIsSemver({
  version,
}: {
  version: string | undefined;
}) {
  const organization = useOrganization();

  const {data, isError, isPending} = useApiQuery<Release>(
    [`/organizations/${organization.slug}/releases/${version}/`],
    {staleTime: 0, enabled: Boolean(version)}
  );

  if (isPending || isError || !data?.versionInfo) {
    return false;
  }

  return isVersionInfoSemver(data.versionInfo.version);
}
