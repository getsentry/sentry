import {useEffect, useMemo} from 'react';

import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {organizationConfigIntegrationsQueryOptions} from 'sentry/components/repositories/scmIntegrationTree/organizationConfigIntegrationsQueryOptions';
import {organizationIntegrationsQueryOptions} from 'sentry/endpoints/organizations/organizationsIntegrationsQueryOptions';
import type {
  IntegrationProvider,
  IntegrationRepository,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useInfiniteQuery, useQueries, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type ScmIntegrationTreeData = {
  connectedIdentifiers: Set<string>;
  connectedRepos: Repository[];
  isError: boolean;
  isPending: boolean;
  refetchIntegrations: () => void;
  reposByIntegrationId: Record<string, IntegrationRepository[]>;
  reposPendingByIntegrationId: Record<string, boolean>;
  reposQueryOptions: ReturnType<typeof organizationRepositoriesInfiniteOptions>;
  scmIntegrations: OrganizationIntegration[];
  scmProviders: IntegrationProvider[];
};

export function useScmIntegrationTreeData(): ScmIntegrationTreeData {
  const organization = useOrganization();

  // 1. Fetch all integration providers and filter to SCM
  const providersQuery = useQuery(
    organizationConfigIntegrationsQueryOptions({organization})
  );

  const scmProviders = useMemo(
    () =>
      (providersQuery.data?.providers ?? [])
        .filter(p => p.metadata.features.some(f => f.featureGate.includes('commits')))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [providersQuery.data]
  );

  const scmProviderKeys = useMemo(
    () => new Set(scmProviders.map(p => p.key)),
    [scmProviders]
  );

  // 2. Fetch installed integrations and filter to SCM providers
  const integrationsQuery = useQuery(
    organizationIntegrationsQueryOptions({
      organization,
      features: ['commits'],
    })
  );

  const scmIntegrations = useMemo(
    () =>
      (integrationsQuery.data ?? []).filter(
        i => i !== null && scmProviderKeys.has(i.provider.key)
      ),
    [integrationsQuery.data, scmProviderKeys]
  );

  // 3. Fetch already-connected repos, auto-paginate to get all
  const reposQueryOptions = organizationRepositoriesInfiniteOptions({
    organization,
    staleTime: 0,
  });
  const {
    data: reposPages,
    hasNextPage: reposHasNextPage,
    isFetchingNextPage: reposIsFetchingNextPage,
    fetchNextPage: reposFetchNextPage,
    isError: reposIsError,
    refetch: reposRefetch,
  } = useInfiniteQuery(reposQueryOptions);

  useEffect(() => {
    if (!reposIsFetchingNextPage && reposHasNextPage) {
      reposFetchNextPage();
    }
  }, [reposHasNextPage, reposIsFetchingNextPage, reposFetchNextPage]);

  const connectedRepos = useMemo(
    () => reposPages?.pages.flatMap(page => page.json) ?? [],
    [reposPages]
  );

  // Use repo.name for matching, not externalSlug. For GitLab, externalSlug is a
  // numeric project ID which never matches IntegrationRepository.identifier.
  // repo.name is consistently "owner/repo" format across all SCM providers.
  const connectedIdentifiers = useMemo(
    () => new Set(connectedRepos.map(r => r.name)),
    [connectedRepos]
  );

  // 4. Fetch available repos for each SCM integration in parallel.
  // Use `combine` to derive a stable Record directly from useQueries,
  // avoiding the unstable array reference in a useMemo dependency.
  const {reposByIntegrationId, reposPendingByIntegrationId} = useQueries({
    queries: scmIntegrations.map(integration =>
      apiOptions.as<{repos: IntegrationRepository[]; searchable: boolean}>()(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration.id,
          },
          staleTime: 0,
        }
      )
    ),
    combine: results => ({
      reposByIntegrationId: Object.fromEntries(
        scmIntegrations.map((integration, i) => [
          integration.id,
          results[i]?.data?.repos ?? [],
        ])
      ),
      reposPendingByIntegrationId: Object.fromEntries(
        scmIntegrations.map((integration, i) => [
          integration.id,
          results[i]?.isPending ?? false,
        ])
      ),
    }),
  });

  const isPending =
    providersQuery.isPending ||
    integrationsQuery.isPending ||
    (reposPages === undefined && !reposIsError);

  const isError = providersQuery.isError || integrationsQuery.isError || reposIsError;

  return {
    scmProviders,
    scmIntegrations,
    connectedRepos,
    connectedIdentifiers,
    refetchIntegrations: () => {
      providersQuery.refetch();
      integrationsQuery.refetch();
      reposRefetch();
    },
    reposByIntegrationId,
    reposPendingByIntegrationId,
    reposQueryOptions,
    isPending,
    isError,
  };
}
