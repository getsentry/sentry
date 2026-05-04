import {useMemo, useState} from 'react';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';

import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {organizationConfigIntegrationsQueryOptions} from 'sentry/components/repositories/scmIntegrationTree/organizationConfigIntegrationsQueryOptions';
import {getProviderConfigUrl} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {
  Integration,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isScmProvider} from 'sentry/utils/integrationUtil';
import {organizationRepositoriesInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ConnectProviderDropdown} from 'sentry/views/settings/organizationRepositories/connectProviderDropdown';
import {NoIntegrationsEmptyState} from 'sentry/views/settings/organizationRepositories/noIntegrationsEmptyState';
import type {ScmInstallation} from 'sentry/views/settings/organizationRepositories/scmRepositoryTable';
import {ScmRepositoryTable} from 'sentry/views/settings/organizationRepositories/scmRepositoryTable';
import {useRepoSearch} from 'sentry/views/settings/organizationRepositories/useRepoSearch';
import {organizationIntegrationsQueryOptions} from 'sentry/views/settings/seer/overview/utils/organizationIntegrationsQueryOptions';

import {useDeleteIntegration} from './useDeleteIntegration';

const SCM_PROVIDER_ORDER = [
  'github',
  'github_enterprise',
  'gitlab',
  'bitbucket',
  'bitbucket_server',
  'vsts',
];

export function OrganizationRepositoriesV2() {
  const organization = useOrganization();
  const hasAccess = hasEveryAccess(['org:integrations'], {organization});
  const [searchTerm, setSearchTerm] = useState('');

  const providersQuery = useQuery(
    organizationConfigIntegrationsQueryOptions({organization})
  );

  const scmProviders = useMemo(() => {
    const providers = (providersQuery.data?.providers ?? []).filter(isScmProvider);
    return sortBy(providers, [
      p => {
        const idx = SCM_PROVIDER_ORDER.indexOf(p.key);
        return idx === -1 ? SCM_PROVIDER_ORDER.length : idx;
      },
      p => p.name,
    ]);
  }, [providersQuery.data]);

  const scmProviderKeys = useMemo(() => scmProviders.map(p => p.key), [scmProviders]);

  const integrationsQuery = useQuery(
    organizationIntegrationsQueryOptions({organization})
  );

  const scmIntegrations = useMemo(() => {
    if (integrationsQuery.data === undefined) {
      return [];
    }
    return integrationsQuery.data.filter(
      i => i !== null && scmProviderKeys.includes(i.provider.key)
    );
  }, [integrationsQuery.data, scmProviderKeys]);

  const reposQueryOptions = organizationRepositoriesInfiniteOptions({
    organization,
    staleTime: 0,
  });
  const reposQuery = useInfiniteQuery(reposQueryOptions);
  useFetchAllPages({result: reposQuery});

  const allRepos = useMemo<Repository[]>(
    () => reposQuery.data?.pages.flatMap(page => page.json) ?? [],
    [reposQuery.data]
  );
  const reposLoading =
    !reposQuery.data || reposQuery.hasNextPage || reposQuery.isFetchingNextPage;

  const reposByIntegrationId = useMemo(
    () => groupBy(allRepos, r => r.integrationId),
    [allRepos]
  );

  const codeMappingsQuery = useInfiniteQuery(
    apiOptions.asInfinite<RepositoryProjectPathConfig[]>()(
      '/organizations/$organizationIdOrSlug/code-mappings/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {per_page: 100},
        staleTime: 10_000,
      }
    )
  );
  useFetchAllPages({result: codeMappingsQuery});

  const mappedProjectSlugsByRepoId = useMemo(() => {
    const mappings = codeMappingsQuery.data?.pages.flatMap(p => p.json) ?? [];
    return mapValues(
      groupBy(mappings, m => m.repoId),
      ms => uniq(ms.map(m => m.projectSlug))
    );
  }, [codeMappingsQuery.data]);

  const mappingsLoading =
    codeMappingsQuery.isPending ||
    codeMappingsQuery.hasNextPage ||
    codeMappingsQuery.isFetchingNextPage;

  const installationsByProviderKey = useMemo(() => {
    const installations = scmIntegrations.map<ScmInstallation>(integration => ({
      integration,
      repositories: reposByIntegrationId[integration.id] ?? [],
      reposLoading,
      manageUrl: getProviderConfigUrl(integration) ?? undefined,
      mappedProjectSlugsByRepoId,
      mappingsLoading,
      uninstallButtonProps: hasAccess
        ? undefined
        : {
            disabled: true,
            tooltipProps: {
              title: t(
                'You must be an organization owner, manager or admin to uninstall this provider'
              ),
            },
          },
    }));
    return groupBy(installations, i => i.integration.provider.key);
  }, [
    scmIntegrations,
    reposByIntegrationId,
    reposLoading,
    mappedProjectSlugsByRepoId,
    mappingsLoading,
    hasAccess,
  ]);

  const handleAddIntegration = (_data: Integration) => {
    integrationsQuery.refetch();
    reposQuery.refetch();
  };

  const handleDeleteIntegration = useDeleteIntegration({
    onSuccess: () => {
      integrationsQuery.refetch();
      reposQuery.refetch();
    },
  });

  const repoMatches = useRepoSearch(allRepos, searchTerm);

  const isLoading = providersQuery.isPending || integrationsQuery.isPending;
  const isError =
    providersQuery.isError || integrationsQuery.isError || reposQuery.isError;

  const pageDescription = tct(
    'Connecting a repo to a project enables [suspectCommits:Suspect Commits] on issues, [suggestedAssignees:Suggested Assignees] based on code owners, the ability to mark an issue [resolvedViaCommit:Resolved via Commit or PR], and is a requirement for [seer:Seer].',
    {
      suspectCommits: (
        <ExternalLink href="https://docs.sentry.io/product/issues/suspect-commits/" />
      ),
      suggestedAssignees: (
        <ExternalLink href="https://docs.sentry.io/product/issues/ownership-rules/#code-owners" />
      ),
      resolvedViaCommit: (
        <ExternalLink href="https://docs.sentry.io/product/releases/associate-commits/#associate-commits-with-a-release" />
      ),
      seer: (
        <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
      ),
    }
  );

  return (
    <AnalyticsArea name="repositories-v2">
      <SentryDocumentTitle title={t('Repositories')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Repositories')}
        subtitle={pageDescription}
        action={
          scmIntegrations.length > 0 ? (
            <ConnectProviderDropdown
              providers={scmProviders.filter(p => p.canAdd)}
              onAddIntegration={handleAddIntegration}
            />
          ) : null
        }
      />
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          onRetry={() => {
            providersQuery.refetch();
            integrationsQuery.refetch();
            reposQuery.refetch();
          }}
        />
      ) : (
        <Stack gap="lg">
          <Input
            type="search"
            placeholder={t('Search repositories')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {!integrationsQuery.isPending && scmIntegrations.length === 0 ? (
            <NoIntegrationsEmptyState
              providers={scmProviders}
              onAddIntegration={handleAddIntegration}
            />
          ) : (
            scmProviders
              .filter(p => installationsByProviderKey[p.key])
              .map(provider => (
                <ScmRepositoryTable
                  key={provider.key}
                  provider={provider}
                  installations={installationsByProviderKey[provider.key]!}
                  repoMatches={repoMatches}
                  onUninstall={inst => handleDeleteIntegration(inst.integration)}
                />
              ))
          )}
        </Stack>
      )}
    </AnalyticsArea>
  );
}
