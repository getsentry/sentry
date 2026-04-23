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
import {RequestError} from 'sentry/utils/requestError/requestError';
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

  // Look up the repo in Sentry. The background link_all_repos task registers
  // all repos after integration install, so most repos will already exist.
  // The query param is an icontains filter to narrow results and avoid
  // pagination; the exact match on Repository.name against
  // IntegrationRepository.identifier mirrors the backend comparison in
  // organization_integration_repos.py:61,80 used to determine isInstalled.
  // Can't use externalSlug because it varies by provider (e.g. GitLab
  // returns a numeric project ID).
  const findExistingRepo = async (
    identifier: string
  ): Promise<Repository | undefined> => {
    const reposQueryOptions = apiOptions.as<Repository[]>()(
      '/organizations/$organizationIdOrSlug/repos/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          status: 'active',
          integration_id: integration.id,
          query: identifier,
        },
        staleTime: 0,
      }
    );
    const matches = (await queryClient.fetchQuery(reposQueryOptions)).json;
    return matches?.find(r => r.name === identifier);
  };

  const handleSelect = async (selection: {value: string}) => {
    const repo = reposByIdentifier.get(selection.value);
    if (!repo) {
      return;
    }

    const optimistic = buildOptimisticRepo(repo, integration);
    onSelect(optimistic);

    setBusy(true);
    try {
      const existing = await findExistingRepo(repo.identifier);
      if (existing) {
        onSelect({...optimistic, ...existing});
        return;
      }

      try {
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
        // Race with link_all_repos: the background task registered the repo
        // between our GET and POST. Re-query to pick up the row it created.
        const detail = error instanceof RequestError ? error.responseJSON?.detail : null;
        if (
          error instanceof RequestError &&
          error.status === 400 &&
          typeof detail === 'object' &&
          detail?.code === 'repo_exists'
        ) {
          const raced = await findExistingRepo(repo.identifier);
          if (raced) {
            onSelect({...optimistic, ...raced});
            return;
          }
        }
        throw error;
      }
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
