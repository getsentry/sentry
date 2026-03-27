import {useState} from 'react';

import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, fetchMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseScmRepoSelectionOptions {
  integration: Integration;
  onSelect: (repo?: Repository) => void;
  reposByIdentifier: Map<string, IntegrationRepository>;
}

function buildOptimisticRepo(
  repo: IntegrationRepository,
  integration: Integration
): Repository {
  return {
    id: '',
    externalId: repo.identifier,
    name: repo.name,
    externalSlug: repo.identifier,
    url: '',
    provider: {
      id: integration.provider.key,
      name: integration.provider.name,
    },
    status: RepositoryStatus.ACTIVE,
    dateCreated: '',
    integrationId: integration.id,
  };
}

export function useScmRepoSelection({
  integration,
  onSelect,
  reposByIdentifier,
}: UseScmRepoSelectionOptions) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleSelect = async (selection: {value: string}) => {
    const repo = reposByIdentifier.get(selection.value);
    if (!repo) {
      return;
    }

    const optimistic = buildOptimisticRepo(repo, integration);
    onSelect(optimistic);

    // Look up the repo in Sentry. The background link_all_repos task
    // registers all repos after integration install, so most repos will
    // already exist. Use a targeted query filtered by name to avoid
    // pagination issues with the full list.
    setBusy(true);
    try {
      const queryKey: ApiQueryKey = [
        getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            status: 'active',
            integration_id: integration.id,
            query: repo.identifier,
          },
        },
      ];
      const [matches] = await queryClient.fetchQuery({
        queryKey,
        queryFn: fetchDataQuery<Repository[]>,
        staleTime: 0,
      });
      // Match on Repository.name === IntegrationRepository.identifier.
      // This is the same comparison the backend uses in the search endpoint
      // (organization_integration_repos.py) to determine isInstalled.
      // Can't use externalSlug because it varies by provider (e.g. GitLab
      // returns a numeric project ID).
      const existing = matches?.find(r => r.name === repo.identifier);

      if (existing) {
        onSelect({...optimistic, ...existing});
        return;
      }

      // Repo not yet registered (link_all_repos may still be running).
      const created = await fetchMutation<Repository>({
        url: `/organizations/${organization.slug}/repos/`,
        method: 'POST',
        data: {
          installation: integration.id,
          identifier: repo.identifier,
          provider: `integrations:${integration.provider.key}`,
        },
      });
      onSelect({...optimistic, ...created});
    } catch {
      onSelect(undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    onSelect(undefined);
  };

  return {
    busy,
    handleSelect,
    handleRemove,
  };
}
