import {useState} from 'react';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
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
    externalId: repo.externalId,
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
      const reposQueryOptions = apiOptions.as<Repository[]>()(
        '/organizations/$organizationIdOrSlug/repos/',
        {
          path: {organizationIdOrSlug: organization.slug},
          query: {
            status: 'active',
            integration_id: integration.id,
            query: repo.identifier,
          },
          staleTime: 0,
        }
      );
      const matches = (await queryClient.fetchQuery(reposQueryOptions)).json;
      // Match on externalId — the same field the backend uses to compute
      // IntegrationRepository.isInstalled in organization_integration_repos.py.
      // repo.name and repo.identifier diverge across providers (GitLab's
      // identifier is a numeric project ID), but externalId is stable.
      const existing = matches?.find(r => r.externalId === repo.externalId);

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
    } catch (error) {
      Sentry.captureException(error);
      addErrorMessage(t('Failed to select repository'));
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
