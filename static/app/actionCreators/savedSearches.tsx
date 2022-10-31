import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {MAX_AUTOCOMPLETE_RECENT_SEARCHES} from 'sentry/constants';
import {t} from 'sentry/locale';
import SavedSearchesStore from 'sentry/stores/savedSearchesStore';
import {RecentSearch, SavedSearch, SavedSearchType} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

export function resetSavedSearches() {
  SavedSearchesStore.onReset();
}

export function fetchSavedSearches(api: Client, orgSlug: string): Promise<SavedSearch[]> {
  const url = `/organizations/${orgSlug}/searches/`;
  SavedSearchesStore.onStartFetchSavedSearches();

  const promise = api.requestPromise(url, {
    method: 'GET',
  });

  promise
    .then(resp => {
      SavedSearchesStore.onFetchSavedSearchesSuccess(resp);
    })
    .catch(err => {
      SavedSearchesStore.onFetchSavedSearchesError(err);
      addErrorMessage(t('Unable to load saved searches'));
    });

  return promise;
}

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

  promise.catch(handleXhrErrorResponse('Unable to save a recent search'));

  return promise;
}

/**
 * Creates a saved search
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param name Saved search name
 * @param query Query to save
 */
export function createSavedSearch(
  api: Client,
  orgSlug: string,
  name: string,
  query: string,
  sort: string | null
): Promise<SavedSearch> {
  const promise = api.requestPromise(`/organizations/${orgSlug}/searches/`, {
    method: 'POST',
    data: {
      type: SavedSearchType.ISSUE,
      query,
      name,
      sort,
    },
  });

  // Need to wait for saved search to save unfortunately because we need to redirect
  // to saved search URL
  promise.then(resp => {
    SavedSearchesStore.onCreateSavedSearchSuccess(resp);
  });

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

  promise.catch(resp => {
    if (resp.status !== 401 && resp.status !== 403) {
      handleXhrErrorResponse('Unable to fetch recent searches')(resp);
    }
  });

  return promise;
}

const getPinSearchUrl = (orgSlug: string): string =>
  `/organizations/${orgSlug}/pinned-searches/`;

export function pinSearch(
  api: Client,
  orgSlug: string,
  type: SavedSearchType,
  query: string,
  sort?: string
): Promise<SavedSearch> {
  const url = getPinSearchUrl(orgSlug);

  // Optimistically update store
  SavedSearchesStore.onPinSearch(type, query, sort);

  const promise = api.requestPromise(url, {
    method: 'PUT',
    data: {
      query,
      type,
      sort,
    },
  });

  promise.then(SavedSearchesStore.onPinSearchSuccess);

  promise.catch(handleXhrErrorResponse('Unable to pin search'));

  promise.catch(() => {
    SavedSearchesStore.onUnpinSearch(type);
  });

  return promise;
}

export function unpinSearch(
  api: Client,
  orgSlug: string,
  type: SavedSearchType,
  pinnedSearch: SavedSearch
) {
  const url = getPinSearchUrl(orgSlug);

  // Optimistically update store
  SavedSearchesStore.onUnpinSearch(type);

  const promise = api.requestPromise(url, {
    method: 'DELETE',
    data: {
      type,
    },
  });

  promise.catch(handleXhrErrorResponse('Unable to un-pin search'));

  promise.catch(() => {
    const {type: pinnedType, query} = pinnedSearch;
    SavedSearchesStore.onPinSearch(pinnedType, query);
  });

  return promise;
}

/**
 * Send a DELETE request to remove a saved search
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param search The search to remove.
 */
export function deleteSavedSearch(
  api: Client,
  orgSlug: string,
  search: SavedSearch
): Promise<void> {
  const url = `/organizations/${orgSlug}/searches/${search.id}/`;

  const promise = api
    .requestPromise(url, {
      method: 'DELETE',
    })
    .then(() => SavedSearchesStore.onDeleteSavedSearchSuccess(search))
    .catch(handleXhrErrorResponse('Unable to delete a saved search'));

  return promise;
}
