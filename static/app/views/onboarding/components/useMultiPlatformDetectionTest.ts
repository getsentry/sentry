import {skipToken, useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const SUPPORTED_PROVIDER = 'integrations:github';

/**
 * Hits the measurement-only `platforms-test` endpoint, which emits structural
 * metrics server-side and returns no content.
 */
export function useMultiPlatformDetectionTest(repository: Repository | undefined) {
  const organization = useOrganization();
  const repoId = repository?.id;
  const isSupported = repository?.provider.id === SUPPORTED_PROVIDER;

  useQuery({
    ...apiOptions.as<null>()(
      '/organizations/$organizationIdOrSlug/repos/$repoId/platforms-test/',
      {
        path:
          repoId && isSupported
            ? {organizationIdOrSlug: organization.slug, repoId}
            : skipToken,
        staleTime: 30_000,
      }
    ),
    retry: false,
  });
}
