import {useMemo, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';

interface RepoSearchResult {
  repos: IntegrationRepository[];
}

interface RepoSelectorProps {
  integration: Integration;
  onAddRepo: (repo: IntegrationRepository) => void;
  onRemoveRepo: (identifier: string) => void;
  selectedRepos: IntegrationRepository[];
}

export function RepoSelector({
  integration,
  selectedRepos,
  onAddRepo,
  onRemoveRepo,
}: RepoSelectorProps) {
  const organization = useOrganization();
  const [search, setSearch] = useState<string>();
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

  const searchResult = useMemo(() => query.data?.[0] ?? {repos: []}, [query.data]);

  const selectedIdentifiers = useMemo(
    () => new Set(selectedRepos.map(r => r.identifier)),
    [selectedRepos]
  );

  const dropdownItems = useMemo(() => {
    return searchResult.repos.map(repo => ({
      value: repo.identifier,
      label: selectedIdentifiers.has(repo.identifier)
        ? `${repo.name} (Selected)`
        : repo.name,
      textValue: repo.name,
      disabled: selectedIdentifiers.has(repo.identifier),
    }));
  }, [searchResult, selectedIdentifiers]);

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={false}
        options={dropdownItems}
        onChange={selection => {
          const repo = searchResult.repos.find(r => r.identifier === selection.value);
          if (repo) {
            onAddRepo(repo);
          }
        }}
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
          <OverlayTrigger.Button {...triggerProps}>
            {selectedRepos.length > 0
              ? t('%d selected', selectedRepos.length)
              : t('Search repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepos.length > 0 && (
        <Stack gap="sm">
          {selectedRepos.map(repo => (
            <Flex key={repo.identifier} align="center" gap="sm">
              <Flex flexGrow={1}>
                <Text size="sm">{repo.name}</Text>
              </Flex>
              <Button
                size="zero"
                priority="link"
                icon={<IconClose size="xs" />}
                aria-label={t('Remove %s', repo.name)}
                onClick={() => onRemoveRepo(repo.identifier)}
              />
            </Flex>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
