import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isScmProvider} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

import {sortByScmProviderOrder} from './scmProviderOrder';

type ScmProvidersData = {
  // First active SCM integration, if any. Kept for callers that only support a
  // single integration (the onboarding connect step).
  activeIntegrationExisting: Integration | null;
  // Every active SCM integration, for callers that let the user pick which one
  // to search repos within (the project-creation connect surface).
  activeIntegrations: Integration[];
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
  refetchIntegrations: () => void;
  scmProviders: IntegrationProvider[];
};

/**
 * Fetches SCM integration providers and active installations for use in the
 * onboarding connect step. SCM providers are identified by `isScmProvider`.
 *
 * Note: Intentionally avoids reusing useScmIntegrationTreeData -- it fetches
 * connected repos and pagination data we don't need, and doesn't filter
 * integrations by active status.
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
      // Order providers the same way ScmProviderPills displays them (primary
      // providers first, then the rest) so every consumer lists them alike.
      sortByScmProviderOrder(
        (providersQuery.data?.providers ?? []).filter(isScmProvider),
        p => p.key
      ),
    [providersQuery.data]
  );

  // Use integrationType=source_code_management to filter server-side to
  // GitHub, GitLab, Bitbucket, Azure DevOps. Still need client-side active
  // status check since the endpoint also returns disabled/pending deletion.
  const integrationsQuery = useQuery(
    apiOptions.as<Integration[]>()('/organizations/$organizationIdOrSlug/integrations/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {integrationType: 'source_code_management'},
      staleTime: 0,
    })
  );

  const activeIntegrations = useMemo(
    () =>
      // Same provider order as scmProviders, so activeIntegrationExisting (the
      // first one) prioritizes the primary providers too.
      sortByScmProviderOrder(
        (integrationsQuery.data ?? []).filter(
          i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
        ),
        i => i.provider.key
      ),
    [integrationsQuery.data]
  );

  return {
    // The onboarding connect step only supports a single active SCM
    // integration, so it reads the first one.
    activeIntegrationExisting: activeIntegrations[0] ?? null,
    activeIntegrations,
    scmProviders,
    isPending: providersQuery.isPending || integrationsQuery.isPending,
    isError: providersQuery.isError || integrationsQuery.isError,
    refetch: () => {
      providersQuery.refetch();
      integrationsQuery.refetch();
    },
    refetchIntegrations: integrationsQuery.refetch,
  };
}
