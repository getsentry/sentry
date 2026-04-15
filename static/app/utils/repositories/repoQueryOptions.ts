import type {InfiniteData} from '@tanstack/react-query';

import type {Repository, RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';

/**
 * Select helper that flattens infinite pages and deduplicates repositories
 * by `externalId`. Use as the `select` option with `useInfiniteQuery`.
 */
export function selectUniqueRepos(data: InfiniteData<ApiResponse<Repository[]>>) {
  const uniqueReposMap = new Map<string, Repository>();
  for (const page of data.pages) {
    for (const repo of page.json) {
      if (repo.externalId && !uniqueReposMap.has(repo.externalId)) {
        uniqueReposMap.set(repo.externalId, repo);
      }
    }
  }
  return Array.from(uniqueReposMap.values());
}

export function organizationRepositoriesInfiniteOptions({
  organization,
  query,
  staleTime,
}: {
  organization: Organization;
  query?: {
    cursor?: string;
    integration_id?: string;
    per_page?: number;
    query?: string;
    sort?: Sort;
    status?: 'active' | 'deleted' | 'unmigratable';
  };
  staleTime?: number;
}) {
  const sortQuery = query?.sort ? encodeSort(query.sort) : undefined;
  return apiOptions.asInfinite<Repository[]>()(
    '/organizations/$organizationIdOrSlug/repos/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: 100, ...query, sort: sortQuery},
      staleTime: staleTime ?? 0,
    }
  );
}

export function organizationRepositoriesWithSettingsInfiniteOptions({
  organization,
  query,
  staleTime,
}: {
  organization: Organization;
  query?: {
    cursor?: string;
    integration_id?: string;
    per_page?: number;
    query?: string;
    sort?: Sort;
    status?: 'active' | 'deleted' | 'unmigratable';
  };
  staleTime?: number;
}) {
  const sortQuery = query?.sort ? encodeSort(query.sort) : undefined;
  return apiOptions.asInfinite<RepositoryWithSettings[]>()(
    '/organizations/$organizationIdOrSlug/repos/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {expand: 'settings', per_page: 100, ...query, sort: sortQuery},
      staleTime: staleTime ?? 0,
    }
  );
}
