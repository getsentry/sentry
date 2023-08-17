import {useEffect} from 'react';

import {Client} from 'sentry/api';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useApiQuery} from 'sentry/utils/queryClient';

type ReleaseRegistrySdk = Record<
  string,
  {
    canonical: string;
    main_docs_url: string;
    name: string;
    package_url: string;
    repo_url: string;
    version: string;
  }
>;

// This exists because /extensions/type/search API is not prefixed with
// /api/0/, but the default API client on the abstract issue form is...
const API_CLIENT = new Client({baseUrl: '', headers: {}, credentials: 'omit'});

/**
 * Fetches the release registry list for SDKs
 */
export function useSourcePackageRegistries() {
  const releaseRegistrySdk = useApiQuery<ReleaseRegistrySdk>(
    ['https://release-registry.services.sentry.io/sdks'],
    {
      staleTime: Infinity,
    },
    API_CLIENT
  );

  useEffect(() => {
    if (releaseRegistrySdk.error) {
      handleXhrErrorResponse(
        'Failed to fetch sentry release registry',
        releaseRegistrySdk.error
      );
    }
  }, [releaseRegistrySdk.error]);

  return {...releaseRegistrySdk, isLoading};
}
