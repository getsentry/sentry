import {useInfiniteQuery, type InfiniteData} from '@tanstack/react-query';

import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import {RepositoryStatus, type Repository} from 'sentry/types/integrations';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

function toRepoOption(repo: Repository): SelectOption<Repository['id']> {
  return {
    value: repo.id,
    label: repo.name,
    textValue: repo.name,
    leadingItems: getIntegrationIcon(repo.provider?.name?.toLowerCase() || ''),
  };
}

function selectRepositoryOptions(
  data: InfiniteData<ApiResponse<Repository[]>>
): Array<SelectOptionOrSection<string>> {
  const repositories = selectUniqueRepos(data);
  if (repositories.length > 100) {
    // SelectSections disable virtualized rendering in CompactSelect, so after
    // a certain point we gotta skip them and render one big list.
    return repositories.map(toRepoOption);
  }
  const connected = new Set<Repository>();
  const disconnected = new Set<Repository>();
  for (const repo of repositories) {
    if (repo.integrationId && repo.status === RepositoryStatus.ACTIVE) {
      connected.add(repo);
    }
  }
  if (disconnected.size === 0) {
    return Array.from(connected.values().map(toRepoOption));
  }
  return [
    {
      key: 'connected',
      label: t('Connected'),
      options: Array.from(connected.values().map(toRepoOption)),
    },
    {
      key: 'disconnected',
      label: t('Disconnected'),
      disabled: true,
      options: Array.from(disconnected.values().map(toRepoOption)),
    },
  ];
}

export function useCompactSelectRepositoryOptions() {
  const organization = useOrganization();
  const result = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectRepositoryOptions,
  });
  useFetchAllPages({result});

  return result;
}
