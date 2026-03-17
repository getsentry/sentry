import {useMemo, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {addRepository, hideRepository} from 'sentry/actionCreators/integrations';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useApiQuery, useQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';

interface RepoSearchResult {
  repos: IntegrationRepository[];
}

interface RepoSelectorProps {
  integration: Integration;
  onSelect: (repo: Repository | null) => void;
  selectedRepo: Repository | null;
}

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

export function RepoSelector({integration, selectedRepo, onSelect}: RepoSelectorProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [search, setSearch] = useState<string>();
  const [adding, setAdding] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 200);

  // Track the ID of a repo we added during this session so we can clean
  // it up if the user switches to a different repo.
  const addedRepoIdRef = useRef<string | null>(null);

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

  // Search for repos available on the provider
  const searchQuery = useQuery({
    queryKey: [
      getApiUrl(
        `/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/`,
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration.id,
          },
        }
      ),
      {method: 'GET', query: {search: debouncedSearch}},
    ] as const,
    queryFn: async context => {
      return fetchDataQuery<RepoSearchResult>(context);
    },
    retry: 0,
    staleTime: 20_000,
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
    enabled: !!debouncedSearch,
  });

  const {reposByIdentifier, dropdownItems} = useMemo(
    () =>
      (searchQuery.data?.[0]?.repos ?? []).reduce(
        (acc, repo) => {
          acc.reposByIdentifier.set(repo.identifier, repo);
          acc.dropdownItems.push({
            value: repo.identifier,
            label: repo.isInstalled ? `${repo.name} (Already Added)` : repo.name,
            textValue: repo.name,
            disabled: repo.identifier === selectedRepo?.externalSlug,
          });
          return acc;
        },
        {
          reposByIdentifier: new Map<string, IntegrationRepository>(),
          dropdownItems: [] as Array<{
            disabled: boolean;
            label: string;
            textValue: string;
            value: string;
          }>,
        }
      ),
    [searchQuery.data, selectedRepo]
  );

  // Delete a repo we previously added during this session (fire-and-forget).
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

    // Clean up any repo we added previously in this session
    cleanupPreviousAdd();

    // Optimistic: show the repo immediately
    onSelect(integrationRepoToOptimisticRepo(repo, integration));

    if (repo.isInstalled) {
      // Already in Sentry -- look up the real Repository by external slug
      const existing = existingReposBySlug.get(repo.identifier);
      if (existing) {
        onSelect(existing);
      }
      return;
    }

    // New repo -- register it in Sentry
    setAdding(true);
    try {
      const created = await addRepository(
        api,
        organization.slug,
        repo.identifier,
        integration
      );
      onSelect(created);
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

    // Optimistic: clear immediately
    const previous = selectedRepo;
    onSelect(null);

    // Only delete from Sentry if we added it during this session
    if (addedRepoIdRef.current && addedRepoIdRef.current === previous.id) {
      addedRepoIdRef.current = null;
      try {
        await hideRepository(api, organization.slug, previous.id);
      } catch {
        onSelect(previous);
      }
    }
  };

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={false}
        options={dropdownItems}
        onChange={handleSelect}
        value={undefined}
        menuTitle={t('Repositories')}
        emptyMessage={
          searchQuery.isFetching
            ? t('Searching\u2026')
            : debouncedSearch
              ? t('No repositories found.')
              : t('Type to search repositories')
        }
        search={{
          placeholder: t('Search repositories'),
          filter: false,
          onChange: setSearch,
        }}
        loading={searchQuery.isFetching}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} busy={adding}>
            {selectedRepo ? selectedRepo.name : t('Search repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepo && (
        <Flex align="center" gap="sm">
          <Flex flexGrow={1}>
            <Text size="sm">{selectedRepo.name}</Text>
          </Flex>
          <Button
            size="zero"
            priority="link"
            icon={<IconClose size="xs" />}
            aria-label={t('Remove %s', selectedRepo.name)}
            onClick={handleRemove}
          />
        </Flex>
      )}
    </Stack>
  );
}
