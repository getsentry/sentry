import {useMemo, useRef, useState} from 'react';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
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

  // Fetch repos already registered in Sentry for this integration, so we
  // can look up the real Repository (with Sentry ID) for "Already Added" repos.
  const {data: existingRepos, isPending: existingReposPending} = useApiQuery<
    Repository[]
  >(
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

    // eslint-disable-next-line no-console
    console.log('[useScmRepoSelection]', {
      isInstalled: repo.isInstalled,
      identifier: repo.identifier,
      existingRepoKeys: [...existingReposBySlug.keys()],
      existingMatch: existingReposBySlug.get(repo.identifier),
    });

    if (repo.isInstalled) {
      // Repo already exists in Sentry — use the existing record if we can
      // find it, otherwise keep the optimistic value. Either way, no POST needed.
      const existing = existingReposBySlug.get(repo.identifier);
      if (existing) {
        onSelect({...optimistic, ...existing});
      }
      return;
    }

    // Note: for project creation (non-onboarding), we'll also need to handle
    // migrateRepository for repos previously connected via legacy plugins.
    setBusy(true);
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
      addedRepoIdRef.current = created.id;
    } catch {
      // 400 means the repo already exists in Sentry (e.g., previously added
      // then hidden). Keep the optimistic selection — the repo is valid.
      // Only revert for other errors (network failures, etc).
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
    // Busy while adding/removing a repo or while existing repos are still
    // loading. The UI disables the CompactSelect and remove button when true.
    busy: busy || existingReposPending,
    handleSelect,
    handleRemove,
  };
}
