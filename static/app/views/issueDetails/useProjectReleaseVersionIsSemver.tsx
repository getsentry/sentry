import {skipToken, useQuery} from '@tanstack/react-query';

import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

export function useProjectReleaseVersionIsSemver({
  version,
  enabled,
}: {
  enabled: boolean;
  version: string | undefined;
}) {
  const organization = useOrganization();

  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<Release>()(
      '/organizations/$organizationIdOrSlug/releases/$version/',
      {
        path:
          version && enabled
            ? {organizationIdOrSlug: organization.slug, version}
            : skipToken,
        staleTime: 0,
      }
    ),
  });

  if (isPending || isError || !data?.versionInfo) {
    return false;
  }

  return isVersionInfoSemver(data.versionInfo.version);
}
