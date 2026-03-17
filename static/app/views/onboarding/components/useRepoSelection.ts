import {useMemo, useRef, useState} from 'react';

import {addRepository, hideRepository} from 'sentry/actionCreators/integrations';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

function integrationRepoToOptimisticRepo(
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

interface UseRepoSelectionOptions {
  integration: Integration;
  onSelect: (repo: Repository | null) => void;
  reposByIdentifier: Map<string, IntegrationRepository>;
  selectedRepo: Repository | null;
}

export function useRepoSelection({
  integration,
  selectedRepo,
  onSelect,
  reposByIdentifier,
}: UseRepoSelectionOptions) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [adding, setAdding] = useState(false);

  // Fetch repos already registered in Sentry for this integration, so we
  // can look up the real Repository (with Sentry ID) for "Already Added" repos.
  const {data: existingRepos} = useApiQuery<Repository[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {status: 'active', integration_id: integration.id}},
    ],
    {staleTime: 0}
  );

  const existingReposBySlug = useMemo(
    () => new Map((existingRepos ?? []).map(r => [r.externalSlug, r])),
    [existingRepos]
  );

  // Track the ID of a repo we added during this session so we can clean
  // it up if the user switches to a different repo.
  const addedRepoIdRef = useRef<string | null>(null);

  const cleanupPreviousAdd = () => {
    if (addedRepoIdRef.current) {
      hideRepository(api, organization.slug, addedRepoIdRef.current).catch(() => {});
      addedRepoIdRef.current = null;
    }
  };

  const handleSelect = async (selection: {value: string}) => {
    const repo = reposByIdentifier.get(selection.value);
    if (!repo) {
      return;
    }

    cleanupPreviousAdd();

    const optimistic = integrationRepoToOptimisticRepo(repo, integration);
    onSelect(optimistic);

    if (repo.isInstalled) {
      const existing = existingReposBySlug.get(repo.identifier);
      if (existing) {
        onSelect({...optimistic, id: existing.id});
      }
      return;
    }

    setAdding(true);
    try {
      const created = await addRepository(
        api,
        organization.slug,
        repo.identifier,
        integration
      );
      onSelect({...optimistic, id: created.id});
      addedRepoIdRef.current = created.id;
    } catch {
      onSelect(null);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedRepo) {
      return;
    }

    const previous = selectedRepo;
    onSelect(null);

    if (addedRepoIdRef.current && addedRepoIdRef.current === previous.id) {
      addedRepoIdRef.current = null;
      try {
        await hideRepository(api, organization.slug, previous.id);
      } catch {
        onSelect(previous);
      }
    }
  };

  return {adding, handleSelect, handleRemove};
}
