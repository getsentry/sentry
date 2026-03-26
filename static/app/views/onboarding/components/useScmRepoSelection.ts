import {useRef, useState} from 'react';

import {Client} from 'sentry/api';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
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
  const {selectedRepository} = useOnboardingContext();
  const [busy, setBusy] = useState(false);

  // Track the ID of a repo we added during this session so we can clean
  // it up if the user switches to a different repo.
  const addedRepoIdRef = useRef<string | null>(null);

  // Best-effort cleanup: fire-and-forget the hide request. If it fails the
  // repo stays registered in Sentry but is non-critical for the onboarding flow.
  const cleanupPreviousAdd = () => {
    if (addedRepoIdRef.current) {
      fetchMutation({
        url: `/organizations/${organization.slug}/repos/${addedRepoIdRef.current}/`,
        method: 'PUT',
        data: {status: 'hidden'},
      }).catch(() => {});
      addedRepoIdRef.current = null;
    }
  };

  const handleSelect = async (selection: {value: string}) => {
    const repo = reposByIdentifier.get(selection.value);
    if (!repo) {
      return;
    }

    cleanupPreviousAdd();

    const optimistic = buildOptimisticRepo(repo, integration);
    onSelect(optimistic);

    // Check if the repo already exists in Sentry (e.g. created by the
    // background link_all_repos task or a previous session). Use a targeted
    // query filtered by name to avoid pagination issues with the full list.
    setBusy(true);
    try {
      const api = new Client();
      const matches = await api.requestPromise(
        `/organizations/${organization.slug}/repos/`,
        {
          query: {
            status: 'active',
            integration_id: integration.id,
            query: repo.identifier,
          },
        }
      );
      const existing = (matches as Repository[])?.find(
        r => r.externalSlug === repo.identifier
      );

      if (existing) {
        onSelect({...optimistic, ...existing});
        return;
      }

      // Repo not found — create it.
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
      addedRepoIdRef.current = created.id;
    } catch {
      onSelect(undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedRepository) {
      return;
    }

    const previous = selectedRepository;
    onSelect(undefined);

    if (addedRepoIdRef.current && addedRepoIdRef.current === previous.id) {
      setBusy(true);
      try {
        await fetchMutation({
          url: `/organizations/${organization.slug}/repos/${previous.id}/`,
          method: 'PUT',
          data: {status: 'hidden'},
        });
        addedRepoIdRef.current = null;
      } catch {
        onSelect(previous);
      } finally {
        setBusy(false);
      }
    }
  };

  return {
    // Busy while adding/removing a repo.
    // The UI disables the Select and remove button when true.
    busy,
    handleSelect,
    handleRemove,
  };
}
