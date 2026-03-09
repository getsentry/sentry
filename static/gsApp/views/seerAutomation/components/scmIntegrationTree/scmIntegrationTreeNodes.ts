import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import type {
  Integration,
  IntegrationProvider,
  IntegrationRepository,
} from 'sentry/types/integrations';

import type {
  ProviderFilter,
  RepoFilter,
  TreeNode,
} from 'getsentry/views/seerAutomation/types';

type Props = {
  connectedIdentifiers: Set<string>;
  expandedIntegrations: Set<string>;
  expandedProviders: Set<string>;
  providerFilter: ProviderFilter;
  repoFilter: RepoFilter;
  reposByIntegrationId: Record<string, IntegrationRepository[]>;
  reposPendingByIntegrationId: Record<string, boolean>;
  scmIntegrations: Integration[];
  scmProviders: IntegrationProvider[];
  search: string;
  togglingRepos: Set<string>;
};

export function buildIntegrationTreeNodes({
  scmProviders,
  scmIntegrations,
  reposByIntegrationId,
  reposPendingByIntegrationId,
  connectedIdentifiers,
  expandedProviders,
  expandedIntegrations,
  togglingRepos,
  search,
  repoFilter,
  providerFilter,
}: Props): TreeNode[] {
  const nodes: TreeNode[] = [];
  const query = search.trim().toLowerCase();

  const visibleProviders =
    providerFilter === 'seer-supported'
      ? scmProviders.filter(p => isSupportedAutofixProvider({id: p.key, name: p.name}))
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

      // nodes.push({type: 'add-config', provider});
    }
  }

  return nodes;
}
