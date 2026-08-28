import {useMemo} from 'react';
import {useQueries, useQuery, type QueryObserverResult} from '@tanstack/react-query';

import {
  SCM_MESSAGING_PROVIDER_KEYS,
  type ScmMessagingProviderKey,
} from 'sentry/components/onboarding/scm/messagingProviders';
import {
  isEligibleForIssueAlerts,
  isIntegrationActive,
} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Settled fetch-state for a single curated messaging provider row.
 *
 * - `installable`        No active integration; the install entry point is shown.
 * - `permission-limited` An active integration exists but is ineligible for Issue
 *                        Alert actions (tenant-type MS Teams). The row is shown with
 *                        a disabled configure CTA and an explanation.
 * - `connected`          An active, eligible integration is present and ready to
 *                        have a destination configured.
 */
type ScmMessagingProviderStatus = 'installable' | 'permission-limited' | 'connected';

export type ScmMessagingProviderViewModel = {
  /**
   * Active integrations that can receive Issue Alert actions.
   * Non-empty iff `status === 'connected'`.
   */
  eligibleIntegrations: OrganizationIntegration[];
  /**
   * The ineligible active integration shown in the `permission-limited` state
   * so the row can display its workspace name. `undefined` for other statuses.
   */
  permissionLimitedIntegration: OrganizationIntegration | undefined;
  provider: IntegrationProvider;
  providerKey: ScmMessagingProviderKey;
  status: ScmMessagingProviderStatus;
};

export function useScmMessagingProviders(): {
  isError: boolean;
  isPending: boolean;
  isRefetchingIntegrations: boolean;
  providers: ScmMessagingProviderViewModel[];
  refetchIntegrations: () => Promise<QueryObserverResult<OrganizationIntegration[]>>;
  retry: () => void;
} {
  const organization = useOrganization();

  const integrationsQuery = useQuery(
    apiOptions.as<OrganizationIntegration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {integrationType: 'messaging'},
        staleTime: Infinity,
      }
    )
  );

  const providerQueries = useQueries({
    queries: SCM_MESSAGING_PROVIDER_KEYS.map(providerKey =>
      apiOptions.as<{providers: IntegrationProvider[]}>()(
        '/organizations/$organizationIdOrSlug/config/integrations/',
        {
          path: {organizationIdOrSlug: organization.slug},
          query: {provider_key: providerKey},
          staleTime: Infinity,
        }
      )
    ),
    // Preserve index → key association so order always matches SCM_MESSAGING_PROVIDER_KEYS.
    combine: results => ({
      byKey: Object.fromEntries(
        results.map((r, i) => [SCM_MESSAGING_PROVIDER_KEYS[i], r.data?.providers[0]])
      ) as Partial<Record<ScmMessagingProviderKey, IntegrationProvider>>,
      isPending: results.some(r => r.isPending),
      isError: results.some(r => r.isError),
      refetch: () => results.forEach(r => r.refetch()),
    }),
  });

  const isPending = integrationsQuery.isPending || providerQueries.isPending;
  const isError = integrationsQuery.isError || providerQueries.isError;

  const providers = useMemo<ScmMessagingProviderViewModel[]>(() => {
    if (isPending || isError) {
      return [];
    }

    const integrations = integrationsQuery.data ?? [];

    return SCM_MESSAGING_PROVIDER_KEYS.flatMap(providerKey => {
      const provider = providerQueries.byKey[providerKey];
      if (!provider) {
        return [];
      }

      const active = integrations.filter(
        i => i.provider.key === providerKey && isIntegrationActive(i)
      );
      const eligible = active.filter(isEligibleForIssueAlerts);
      const status = eligible.length
        ? 'connected'
        : active.length
          ? 'permission-limited'
          : 'installable';

      return [
        {
          providerKey,
          provider,
          status,
          eligibleIntegrations: eligible,
          permissionLimitedIntegration:
            status === 'permission-limited' ? active[0] : undefined,
        },
      ];
    });
  }, [isPending, isError, integrationsQuery.data, providerQueries.byKey]);

  return {
    providers,
    isPending,
    isError,
    isRefetchingIntegrations: integrationsQuery.isRefetching,
    refetchIntegrations: () => integrationsQuery.refetch(),
    retry: () => {
      integrationsQuery.refetch();
      providerQueries.refetch();
    },
  };
}
