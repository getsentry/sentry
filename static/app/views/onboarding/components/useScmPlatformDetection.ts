import {skipToken, useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/platform';
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
  // Empty id means we have an optimistic repo from useScmRepoSelection;
  // the resolved repo with a real id arrives via a subsequent onSelect
  // call. The query can only fetch once we have a real id.
  const canFetch = !!(repoId && isSupported);

  const query = useQuery(
    apiOptions.as<PlatformDetectionResponse>()(
      '/organizations/$organizationIdOrSlug/repos/$repoId/platforms/',
      {
        path: canFetch ? {organizationIdOrSlug: organization.slug, repoId} : skipToken,
        staleTime: 30_000,
      }
    )
  );

  return {
    detectedPlatforms: query.data?.platforms ?? [],
    // A supported repo without a result yet is loading, including the
    // optimistic phase before the real id resolves (so the platform step shows
    // a spinner rather than flashing the manual picker) and the skipToken→
    // enabled gap before `query.isLoading` flips. Unsupported providers or no
    // repo report false. State owners drop a stale optimistic repo (empty id)
    // on load so a refresh mid-resolution can't strand this as a permanent
    // spinner.
    isPending: !!repository && isSupported && !query.data && !query.isError,
    isError: query.isError,
  };
}
