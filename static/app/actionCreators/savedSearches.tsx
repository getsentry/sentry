import {Client, ResponseMeta} from 'sentry/api';
import {MAX_AUTOCOMPLETE_RECENT_SEARCHES} from 'sentry/constants';
import {RecentSearch, SavedSearch, SavedSearchType} from 'sentry/types';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';

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

  promise.catch((err: ResponseMeta) =>
    handleXhrErrorResponse('Unable to save a recent search', err)
  );

  return promise;
}

/**
 * Fetches a list of recent search terms conducted by `user` for `orgSlug`
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query A query term used to filter results
 *
 * @return Returns a list of objects of recent search queries performed by user
 */
export function fetchRecentSearches(
  api: Client,
  orgSlug: string,
  type: SavedSearchType,
  query?: string
): Promise<RecentSearch[]> {
  const url = getRecentSearchUrl(orgSlug);
  const promise = api.requestPromise(url, {
    query: {
      query,
      type,
      limit: MAX_AUTOCOMPLETE_RECENT_SEARCHES,
    },
  });

  promise.catch((resp: ResponseMeta) => {
    if (resp.status !== 401 && resp.status !== 403) {
      handleXhrErrorResponse('Unable to fetch recent searches', resp);
    }
  });

  return promise;
}
