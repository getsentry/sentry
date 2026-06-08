import {skipToken, useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const SUPPORTED_PROVIDER = 'integrations:github';

/**
 * Fire-and-forget measurement call that runs 1:1 alongside
 * {@link useScmPlatformDetection}. It hits the measurement-only
 * `platforms-test` endpoint, which emits structural
 * `onboarding-scm.platform_detection.multi.*` metrics server-side and returns
 * no content. The response is intentionally ignored — this hook exists only to
 * trigger the request, and it never affects the live detector or onboarding.
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
    // Measurement-only: don't retry, and never surface failures.
    retry: false,
  });
}
