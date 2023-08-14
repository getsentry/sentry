import {Client} from 'sentry/api';
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

export function useSourcePackageRegistries() {
  const {isLoading, data} = useApiQuery<ReleaseRegistrySdk>(
    ['https://release-registry.services.sentry.io/sdks'],
    {
      staleTime: Infinity,
    },
    API_CLIENT
  );

  return {
    isLoading,
    data,
  };
}
