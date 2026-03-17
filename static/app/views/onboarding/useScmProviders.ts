import {useMemo} from 'react';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type ScmProvidersData = {
  isError: boolean;
  isPending: boolean;
  refetchIntegrations: () => void;
  scmIntegrationsByProviderKey: Map<string, Integration>;
  scmProviders: IntegrationProvider[];
};

/**
 * Fetches SCM integration providers and active installations for use in the
 * onboarding connect step. Providers are identified by having a feature gate
 * that includes 'commits'.
 *
 * Note: This duplicates the provider filter from useScmIntegrationTreeData but
 * intentionally avoids reusing that hook -- it fetches connected repos and
 * pagination data we don't need, and doesn't filter integrations by active status.
 */
export function useScmProviders(): ScmProvidersData {
  const organization = useOrganization();

  const providersQuery = useQuery(
    apiOptions.as<{providers: IntegrationProvider[]}>()(
      '/organizations/$organizationIdOrSlug/config/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    )
  );

  const scmProviders = useMemo(
    () =>
      (providersQuery.data?.providers ?? []).filter(p =>
        p.metadata.features.some(f => f.featureGate.includes('commits'))
      ),
    // .sort((a, b) => a.name.localeCompare(b.name)),
    [providersQuery.data]
  );

  const scmProviderKeys = useMemo(
    () => new Set(scmProviders.map(p => p.key)),
    [scmProviders]
  );

  const integrationsQuery = useQuery(
    apiOptions.as<Integration[]>()('/organizations/$organizationIdOrSlug/integrations/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    })
  );

  const scmIntegrations = useMemo(
    () =>
      (integrationsQuery.data ?? []).filter(
        i =>
          scmProviderKeys.has(i.provider.key) &&
          i.organizationIntegrationStatus === 'active' &&
          i.status === 'active'
      ),
    [integrationsQuery.data, scmProviderKeys]
  );

  const scmIntegrationsByProviderKey = useMemo(
    () => new Map(scmIntegrations.map(i => [i.provider.key, i])),
    [scmIntegrations]
  );

  return {
    scmProviders,
    scmIntegrationsByProviderKey,
    isPending: providersQuery.isPending || integrationsQuery.isPending,
    isError: providersQuery.isError || integrationsQuery.isError,
    refetchIntegrations: integrationsQuery.refetch,
  };
}
