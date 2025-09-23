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

const getRecentSearchUrl = (orgSlug: string): string =>
  `/organizations/${orgSlug}/recent-searches/`;

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
  query: string
): Promise<SavedSearch> {
  const url = getRecentSearchUrl(orgSlug);
  const promise = api.requestPromise(url, {
    method: 'POST',
    data: {
      query,
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
