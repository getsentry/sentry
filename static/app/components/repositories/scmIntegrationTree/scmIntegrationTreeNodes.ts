import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import type {
  ProviderFilter,
  RepoFilter,
  TreeNode,
} from 'sentry/components/repositories/scmIntegrationTree/types';
import type {
  IntegrationProvider,
  IntegrationRepository,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';

export const DISCONNECTED_SECTION_KEY = '__disconnected__';

type Props = {
  connectedIdentifiers: Set<string>;
  connectedRepos: Repository[];
  expandedIntegrations: Set<string>;
  expandedProviders: Set<string>;
  providerFilter: ProviderFilter;
  repoFilter: RepoFilter;
  reposByIntegrationId: Record<string, IntegrationRepository[]>;
  reposPendingByIntegrationId: Record<string, boolean>;
  scmIntegrations: OrganizationIntegration[];
  scmProviders: IntegrationProvider[];
  search: string;
  togglingRepos: Set<string>;
  hasGitlabSupport?: boolean;
};

export function buildIntegrationTreeNodes({
  scmProviders,
  scmIntegrations,
  connectedRepos,
  reposByIntegrationId,
  reposPendingByIntegrationId,
  connectedIdentifiers,
  expandedProviders,
  expandedIntegrations,
  togglingRepos,
  search,
  repoFilter,
  providerFilter,
  hasGitlabSupport,
}: Props): TreeNode[] {
  const nodes: TreeNode[] = [];
  const query = search.trim().toLowerCase();

  const visibleProviders =
    providerFilter === 'seer-supported'
      ? scmProviders.filter(p =>
          isSupportedAutofixProvider({id: p.key, name: p.name}, hasGitlabSupport)
        )
      : scmProviders;

  for (const provider of visibleProviders) {
    const providerIntegrations = scmIntegrations.filter(
      i => i.provider.key === provider.key
    );

    nodes.push({
      type: 'provider',
      provider,
      isExpanded: expandedProviders.has(provider.key),
      integrationCount: providerIntegrations.length,
    });

    if (expandedProviders.has(provider.key)) {
      for (const integration of providerIntegrations) {
        const repos = reposByIntegrationId[integration.id] ?? [];

        nodes.push({
          type: 'integration',
          integration,
          isExpanded: expandedIntegrations.has(integration.id),
          isReposPending: reposPendingByIntegrationId[integration.id] ?? false,
          repoCount: repos.length,
          connectedRepoCount: repos.filter(r => connectedIdentifiers.has(r.identifier))
            .length,
        });

        if (expandedIntegrations.has(integration.id)) {
          let visibleRepos = query
            ? repos.filter(r => r.name.toLowerCase().includes(query))
            : repos;

          if (repoFilter === 'connected') {
            visibleRepos = visibleRepos.filter(r =>
              connectedIdentifiers.has(r.identifier)
            );
          } else if (repoFilter === 'not-connected') {
            visibleRepos = visibleRepos.filter(
              r => !connectedIdentifiers.has(r.identifier)
            );
          }

          if (visibleRepos.length === 0 && (query || repoFilter !== 'all')) {
            nodes.push({
              type: 'no-match',
              integrationId: integration.id,
              search: query,
              repoFilter,
            });
          } else {
            for (const repo of visibleRepos) {
              nodes.push({
                type: 'repo',
                repo,
                integration,
                isConnected: connectedIdentifiers.has(repo.identifier),
                isToggling: togglingRepos.has(repo.identifier),
              });
            }
          }
        }
      }
    }
  }

  // Disconnected repos: connected to the org but no matching SCM integration
  const scmIntegrationIds = new Set(scmIntegrations.map(i => i.id));
  const disconnectedRepos =
    providerFilter === 'seer-supported' || repoFilter === 'not-connected'
      ? []
      : connectedRepos.filter(
          r =>
            r.url &&
            (!r.integrationId || !scmIntegrationIds.has(r.integrationId)) &&
            (!query || r.name.toLowerCase().includes(query))
        );

  if (disconnectedRepos.length > 0) {
    const isExpanded = expandedProviders.has(DISCONNECTED_SECTION_KEY);
    nodes.push({
      type: 'disconnected-section',
      isExpanded,
      repoCount: disconnectedRepos.length,
    });

    if (isExpanded) {
      for (const repo of disconnectedRepos) {
        nodes.push({
          type: 'disconnected-repo',
          repo,
          isToggling: togglingRepos.has(repo.id),
        });
      }
    }
  }

  return nodes;
}
