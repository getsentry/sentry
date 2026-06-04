import {useCallback, useMemo} from 'react';

import {AUTOFIX_TTL_IN_DAYS} from 'sentry/components/events/autofix/types';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

const BASE_SUPPORTED_PROVIDERS = [
  'github',
  'integrations:github',
  'github_enterprise',
  'integrations:github_enterprise',
];

/**
 * Feature-gated providers. Each entry maps a feature flag to the provider IDs
 * it unlocks. Add new providers here as they become supported.
 */
const FEATURE_GATED_PROVIDERS: Array<{
  flag: string;
  providerIds: string[];
}> = [
  {
    flag: 'seer-gitlab-support',
    providerIds: ['gitlab', 'integrations:gitlab'],
  },
];

/**
 * Pure function for non-hook contexts (e.g. buildIntegrationTreeNodes).
 * Returns true if the provider is in the supported list.
 */
export function isSeerSupportedProvider(
  provider: {id: string; name: string},
  supportedProviderIds: string[]
): boolean {
  return supportedProviderIds.includes(provider.id);
}

/**
 * Returns the list of provider IDs supported for Seer based on the
 * organization's feature flags. To support a new provider, add an entry
 * to FEATURE_GATED_PROVIDERS above.
 */
export function useSeerSupportedProviderIds(): string[] {
  const organization = useOrganization();
  return useMemo(() => {
    const ids = [...BASE_SUPPORTED_PROVIDERS];
    for (const {flag, providerIds} of FEATURE_GATED_PROVIDERS) {
      if (organization.features.includes(flag)) {
        ids.push(...providerIds);
      }
    }
    return ids;
  }, [organization.features]);
}

/**
 * Convenience hook that returns a provider-check callback.
 * Use this in React components that need to test individual providers.
 */
export function useIsSeerSupportedProvider(): (provider: {
  id: string;
  name: string;
}) => boolean {
  const supportedProviderIds = useSeerSupportedProviderIds();
  return useCallback(
    (provider: {id: string; name: string}) =>
      isSeerSupportedProvider(provider, supportedProviderIds),
    [supportedProviderIds]
  );
}

export function getAutofixRunExists(group: Group) {
  const autofixLastRunAsDate = group.seerAutofixLastTriggered
    ? new Date(group.seerAutofixLastTriggered)
    : null;
  const autofixRanWithinTtl = autofixLastRunAsDate
    ? autofixLastRunAsDate >
      new Date(Date.now() - AUTOFIX_TTL_IN_DAYS * 24 * 60 * 60 * 1000)
    : false;

  return autofixRanWithinTtl;
}

export function isIssueQuickFixable(group: Group) {
  return group.seerFixabilityScore && group.seerFixabilityScore > 0.7;
}
