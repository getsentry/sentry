import {Query} from 'history';

import {Client} from 'app/api';
import {MAX_AUTOCOMPLETE_RECENT_SEARCHES} from 'app/constants';
import {SearchType} from 'app/components/smartSearchBar';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import SavedSearchesActions from 'app/actions/savedSearchesActions';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';
import {SavedSearch, RecentSearch, SavedSearchType} from 'app/types';

export function resetSavedSearches() {
  SavedSearchesActions.resetSavedSearches();
}

export function fetchSavedSearches(api: Client, orgId: string): Promise<SavedSearch[]> {
  const url = `/organizations/${orgId}/searches/`;
  const data: Query = {use_org_level: '1'};

  SavedSearchesActions.startFetchSavedSearches();

  const promise = api.requestPromise(url, {
    method: 'GET',
    data,
  });

  promise
    .then(resp => {
      SavedSearchesActions.fetchSavedSearchesSuccess(resp);
    })
    .catch(err => {
      SavedSearchesActions.fetchSavedSearchesError(err);
      addErrorMessage(t('Unable to load saved searches'));
    });

  return promise;
}

export function fetchProjectSavedSearches(
  api: Client,
  orgId: string,
  projectId: string
): Promise<SavedSearch[]> {
  const url = `/projects/${orgId}/${projectId}/searches/`;
  return api.requestPromise(url, {
    method: 'GET',
  });
}

const getRecentSearchUrl = (orgId: string): string =>
  `/organizations/${orgId}/recent-searches/`;

/**
 * Saves search term for `user` + `orgId`
 *
 * @param api API client
 * @param orgId Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query The search term that was used
 */
export function saveRecentSearch(
  api: Client,
  orgId: string,
  type: SavedSearchType,
  query: string
): Promise<SavedSearch> {
  const url = getRecentSearchUrl(orgId);
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
 * @param orgId Organization slug
 * @param name Saved search name
 * @param query Query to save
 */
export function createSavedSearch(
  api: Client,
  orgId: string,
  name: string,
  query: string
): Promise<SavedSearch> {
  const promise = api.requestPromise(`/organizations/${orgId}/searches/`, {
    method: 'POST',
    data: {
      type: SearchType.ISSUE,
      query,
      name,
    },
  });

  // Need to wait for saved search to save unfortunately because we need to redirect
  // to saved search URL
  promise.then(resp => {
    SavedSearchesActions.createSavedSearchSuccess(resp);
  });

  return promise;
}

/**
 * Fetches a list of recent search terms conducted by `user` for `orgId`
 *
 * @param api API client
 * @param orgId Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query A query term used to filter results
 *
 * @return Returns a list of objects of recent search queries performed by user
 */
export function fetchRecentSearches(
  api: Client,
  orgId: string,
  type: SavedSearchType,
  query: string
): Promise<RecentSearch[]> {
  const url = getRecentSearchUrl(orgId);
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

const getPinSearchUrl = (orgId: string): string =>
  `/organizations/${orgId}/pinned-searches/`;

export function pinSearch(
  api: Client,
  orgId: string,
  type: SavedSearchType,
  query: string
): Promise<SavedSearch> {
  const url = getPinSearchUrl(orgId);

  // Optimistically update store
  SavedSearchesActions.pinSearch(type, query);

  const promise = api.requestPromise(url, {
    method: 'PUT',
    data: {
      query,
      type,
    },
  });

  promise.then(SavedSearchesActions.pinSearchSuccess);

  promise.catch(handleXhrErrorResponse('Unable to pin search'));

  promise.catch(() => {
    SavedSearchesActions.unpinSearch(type);
  });

  return promise;
}

export function unpinSearch(
  api: Client,
  orgId: string,
  type: SavedSearchType,
  pinnedSearch: SavedSearch
) {
  const url = getPinSearchUrl(orgId);

  // Optimistically update store
  SavedSearchesActions.unpinSearch(type);

  const promise = api.requestPromise(url, {
    method: 'DELETE',
    data: {
      type,
    },
  });

  promise.catch(handleXhrErrorResponse('Unable to un-pin search'));

  promise.catch(() => {
    const {type: pinnedType, query} = pinnedSearch;
    SavedSearchesActions.pinSearch(pinnedType, query);
  });

  return promise;
}

/**
 * Send a DELETE request to remove a saved search
 *
 * @param api API client
 * @param orgId Organization slug
 * @param search The search to remove.
 */
export function deleteSavedSearch(
  api: Client,
  orgId: string,
  search: SavedSearch
): Promise<void> {
  const url = `/organizations/${orgId}/searches/${search.id}/`;

  const promise = api
    .requestPromise(url, {
      method: 'DELETE',
    })
    .then(() => SavedSearchesActions.deleteSavedSearchSuccess(search))
    .catch(handleXhrErrorResponse('Unable to delete a saved search'));

  return promise;
}
