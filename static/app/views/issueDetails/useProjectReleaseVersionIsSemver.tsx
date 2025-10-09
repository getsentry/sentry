import type {Release} from 'sentry/types/release';
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
      `/organizations/${organization.slug}/releases/${encodeURIComponent(version ?? '')}/`,
    ],
    {staleTime: 0, enabled: Boolean(version) && enabled}
  );

  if (isPending || isError || !data?.versionInfo) {
    return false;
  }

  return isVersionInfoSemver(data.versionInfo.version);
}
