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

function toOptionWithIcon(repo: Repository): SelectOption<Repository['id']> {
  return {
    value: repo.id,
    label: repo.name,
    textValue: repo.name,
    leadingItems: getIntegrationIcon(repo.provider?.name?.toLowerCase() || ''),
  };
}

function toOptionNoAvatar(repo: Repository): SelectOption<Repository['id']> {
  return {
    value: repo.id,
    label: repo.name,
    textValue: repo.name,
  };
}

function makeMapper(size: number) {
  return size > 50 ? toOptionNoAvatar : toOptionWithIcon;
}

function selectRepositoryOptions(
  data: InfiniteData<ApiResponse<Repository[]>>
): Array<SelectOptionOrSection<string>> {
  const repositories = selectUniqueRepos(data);
  const mapper = makeMapper(repositories.length);
  const connected = new Set<Repository>();
  const disconnected = new Set<Repository>();
  for (const repo of repositories) {
    if (repo.integrationId && repo.status === RepositoryStatus.ACTIVE) {
      connected.add(repo);
    } else {
      disconnected.add(repo);
    }
  }
  if (disconnected.size === 0) {
    return Array.from(connected.values().map(mapper));
  }
  return [
    {
      key: 'connected',
      label: t('Connected'),
      options: Array.from(connected.values().map(mapper)),
    },
    {
      key: 'disconnected',
      label: t('Disconnected'),
      disabled: true,
      options: Array.from(disconnected.values().map(mapper)),
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
