import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {RequestError} from 'sentry/utils/requestError/requestError';

export type ReleaseRegistrySdk = Record<
  string,
  {
    canonical: string;
    files: Record<string, {checksums: Record<string, string>}>;
    main_docs_url: string;
    name: string;
    package_url: string;
    repo_url: string;
    version: string;
  }
>;

/**
 * Fetches the release registry list for SDKs
 */
export function useSourcePackageRegistries(organization: Organization) {
  const releaseRegistrySdk = useQuery(
    apiOptions.as<ReleaseRegistrySdk>()('/organizations/$organizationIdOrSlug/sdks/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: Infinity,
    })
  );

  useEffect(() => {
    if (releaseRegistrySdk.error instanceof RequestError) {
      handleXhrErrorResponse(
        'Failed to fetch sentry release registry',
        releaseRegistrySdk.error
      );
    }
  }, [releaseRegistrySdk.error]);

  return releaseRegistrySdk;
}
