import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isScmProvider} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

type ScmProvidersData = {
  activeIntegrationExisting: Integration | null;
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
    () => (providersQuery.data?.providers ?? []).filter(isScmProvider),
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

  const activeIntegration = useMemo(
    () =>
      (integrationsQuery.data ?? []).find(
        i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
      ) ?? null,
    [integrationsQuery.data]
  );

  return {
    // V1 only supports a single active SCM integration in onboarding.
    activeIntegrationExisting: activeIntegration,
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
