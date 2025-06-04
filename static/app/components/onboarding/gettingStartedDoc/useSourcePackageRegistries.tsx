import {useEffect} from 'react';

import type {Organization} from 'sentry/types/organization';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useApiQuery} from 'sentry/utils/queryClient';

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
  const releaseRegistrySdk = useApiQuery<ReleaseRegistrySdk>(
    [`/organizations/${organization.slug}/sdks/`],
    {
      staleTime: Infinity,
    }
  );

  useEffect(() => {
    if (releaseRegistrySdk.error) {
      handleXhrErrorResponse(
        'Failed to fetch sentry release registry',
        releaseRegistrySdk.error
      );
    }
  }, [releaseRegistrySdk.error]);

  return releaseRegistrySdk;
}
