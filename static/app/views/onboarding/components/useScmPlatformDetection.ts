import type {Repository} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface DetectedPlatform {
  bytes: number;
  confidence: string;
  language: string;
  platform: PlatformKey;
  priority: number;
}

interface PlatformDetectionResponse {
  platforms: DetectedPlatform[];
}

const SUPPORTED_PROVIDER = 'integrations:github';

export function useScmPlatformDetection(repository: Repository | undefined) {
  const organization = useOrganization();
  const repoId = repository?.id;
  const isSupported = repository?.provider.id === SUPPORTED_PROVIDER;

  const query = useQuery({
    queryKey: [
      getApiUrl('/organizations/$organizationIdOrSlug/repos/$repoId/platforms/', {
        path: {
          organizationIdOrSlug: organization.slug,
          repoId: repoId!,
        },
      }),
      {method: 'GET'},
    ] as const,
    queryFn: async context => {
      return fetchDataQuery<PlatformDetectionResponse>(context);
    },
    staleTime: 30_000,
    enabled: !!repoId && isSupported,
  });

  const {data} = query;

  return {
    detectedPlatforms: data?.[0]?.platforms ?? [],
    // Use isLoading (isPending && isFetching) so that disabled queries
    // (non-GitHub providers) report false instead of the idle-pending state.
    isPending: query.isPending && query.fetchStatus !== 'idle',
    isError: query.isError,
  };
}
