import {useMemo, useState} from 'react';

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
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
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

export function RepoSelector({integration, selectedRepo, onSelect}: RepoSelectorProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [search, setSearch] = useState<string>();
  const [adding, setAdding] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 200);

  const query = useQuery({
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
      (query.data?.[0]?.repos ?? []).reduce(
        (acc, repo) => {
          acc.reposByIdentifier.set(repo.identifier, repo);
          acc.dropdownItems.push({
            value: repo.identifier,
            label: repo.isInstalled ? `${repo.name} (Already Added)` : repo.name,
            textValue: repo.name,
            disabled: repo.isInstalled || repo.identifier === selectedRepo?.externalSlug,
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
    [query.data, selectedRepo]
  );

  const handleAdd = async (selection: {value: string}) => {
    const repo = reposByIdentifier.get(selection.value);
    if (!repo) {
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
      onSelect(created);
    } catch {
      // Error feedback is handled by addRepository
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedRepo) {
      return;
    }
    try {
      await hideRepository(api, organization.slug, selectedRepo.id);
      onSelect(null);
    } catch {
      // Error feedback is handled by hideRepository
    }
  };

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={false}
        options={dropdownItems}
        onChange={handleAdd}
        value={undefined}
        menuTitle={t('Repositories')}
        emptyMessage={
          query.isFetching
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
        loading={query.isFetching}
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
