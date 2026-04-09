import {skipToken, useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

  const query = useQuery(
    apiOptions.as<PlatformDetectionResponse>()(
      '/organizations/$organizationIdOrSlug/repos/$repoId/platforms/',
      {
        path:
          repoId && isSupported
            ? {organizationIdOrSlug: organization.slug, repoId}
            : skipToken,
        staleTime: 30_000,
      }
    )
  );

  return {
    detectedPlatforms: query.data?.platforms ?? [],
    // Use isLoading so that disabled queries (non-GitHub providers)
    // report false instead of the idle-pending state.
    isPending: query.isLoading,
    isError: query.isError,
  };
}
