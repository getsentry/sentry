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

export function useScmPlatformDetection(repoId: string | undefined) {
  const organization = useOrganization();

  const query = useQuery({
    queryKey: [
      getApiUrl(`/organizations/$organizationIdOrSlug/repos/$repoId/platforms/`, {
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
    enabled: !!repoId,
  });

  const {data} = query;

  return {
    detectedPlatforms: data?.[0]?.platforms ?? [],
    isPending: query.isPending,
    isError: query.isError,
  };
}
