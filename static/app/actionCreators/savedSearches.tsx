import type {Client} from 'sentry/api';
import {MAX_AUTOCOMPLETE_RECENT_SEARCHES} from 'sentry/constants';
import type {RecentSearch, SavedSearch, SavedSearchType} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

// HACK: This prefix is used to prefix the recent searches query to isolate
// search results among the same search type. It intentionally doesn't follow
// typical search syntax because it is meant to be filtered out of the UI
export const NAMESPACE_FILTER_KEY_PREFIX = '__namespace_filter__';

const getRecentSearchUrl = (orgSlug: string): string =>
  `/organizations/${orgSlug}/recent-searches/`;

function getNamespaceFilterKey(namespaceFilterKey: string): string {
  return `${NAMESPACE_FILTER_KEY_PREFIX}:${namespaceFilterKey}`;
}

export function parseQueryFromRecentSearch(
  recentSearchQuery: string,
  namespaceFilterKey?: string
): string {
  if (!namespaceFilterKey) {
    return recentSearchQuery;
  }

  const namespacePrefix = getNamespaceFilterKey(namespaceFilterKey);

  if (recentSearchQuery.startsWith(namespacePrefix)) {
    return recentSearchQuery.slice(namespacePrefix.length).trimStart();
  }

  return recentSearchQuery;
}

/**
 * Saves search term for `user` + `orgSlug`
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query The search term that was used
 */
export function saveRecentSearch(
  api: Client,
  orgSlug: string,
  type: SavedSearchType,
  query: string,
  namespaceFilterKey?: string
): Promise<SavedSearch> {
  const url = getRecentSearchUrl(orgSlug);
  const promise = api.requestPromise(url, {
    method: 'POST',
    data: {
      // Inject the namespaceFilterKey as a prefix to the query, so that we can filter the results for specific use cases
      // that have filters pre-defined.
      query: namespaceFilterKey
        ? `${getNamespaceFilterKey(namespaceFilterKey)} ${query}`
        : query,
      type,
    },
  });

  promise.catch((err: RequestError) =>
    handleXhrErrorResponse('Unable to save a recent search', err)
  );

  return promise;
}

function makeRecentSearchesQueryKey({
  limit,
  orgSlug,
  savedSearchType,
  query,
}: {
  limit: number;
  orgSlug: string;
  savedSearchType: SavedSearchType | null;
  query?: string;
}): ApiQueryKey {
  return [
    getRecentSearchUrl(orgSlug),
    {
      query: {
        query,
        type: savedSearchType,
        limit,
      },
    },
  ];
}

export function useFetchRecentSearches(
  {
    query,
    savedSearchType,
    limit = MAX_AUTOCOMPLETE_RECENT_SEARCHES,
  }: {
    savedSearchType: SavedSearchType | null;
    limit?: number;
    query?: string;
  },
  options: Partial<UseApiQueryOptions<RecentSearch[]>> = {}
) {
  const organization = useOrganization();

  return useApiQuery<RecentSearch[]>(
    makeRecentSearchesQueryKey({
      limit,
      orgSlug: organization.slug,
      query,
      savedSearchType,
    }),
    {
      staleTime: 0,
      enabled: defined(savedSearchType),
      ...options,
    }
  );
}
