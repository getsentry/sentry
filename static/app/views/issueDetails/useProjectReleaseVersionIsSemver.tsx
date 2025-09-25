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
    {staleTime: 0}
  );

  if (!version) {
    return false;
  }

  if (isPending || isError) {
    return false;
  }

  return isVersionInfoSemver(data.versionInfo.version);
}
