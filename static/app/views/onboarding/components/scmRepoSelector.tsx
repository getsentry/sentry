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
  onSelect: (repo: IntegrationRepository | null) => void;
  selectedRepo: IntegrationRepository | null;
}

export function RepoSelector({integration, selectedRepo, onSelect}: RepoSelectorProps) {
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

  const {reposByIdentifier, dropdownItems} = useMemo(
    () =>
      (query.data?.[0]?.repos ?? []).reduce(
        (acc, repo) => {
          acc.reposByIdentifier.set(repo.identifier, repo);
          acc.dropdownItems.push({
            value: repo.identifier,
            label: repo.name,
            textValue: repo.name,
            disabled: repo.identifier === selectedRepo?.identifier,
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

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={false}
        options={dropdownItems}
        onChange={selection => {
          const repo = reposByIdentifier.get(selection.value);
          if (repo) {
            onSelect(repo);
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
            onClick={() => onSelect(null)}
          />
        </Flex>
      )}
    </Stack>
  );
}
