import {MAX_AUTOCOMPLETE_RECENT_SEARCHES} from 'app/constants';
import {SearchType} from 'app/components/smartSearchBar';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import SavedSearchesActions from 'app/actions/savedSearchesActions';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';

export function resetSavedSearches() {
  SavedSearchesActions.resetSavedSearches();
}

export function fetchSavedSearches(api, orgId) {
  const url = `/organizations/${orgId}/searches/`;
  const data = {use_org_level: 1};

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

export function fetchProjectSavedSearches(api, orgId, projectId) {
  const url = `/projects/${orgId}/${projectId}/searches/`;
  return api.requestPromise(url, {
    method: 'GET',
  });
}

const getRecentSearchUrl = orgId => `/organizations/${orgId}/recent-searches/`;

/**
 * Saves search term for `user` + `orgId`
 *
 * @param {Object} api API client
 * @param {String} orgId Organization slug
 * @param {Number} type Context for where search happened, 0 for issue, 1 for event
 * @param {String} query The search term that was used
 */
export function saveRecentSearch(api, orgId, type, query) {
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
 * @param {Object} api API client
 * @param {String} orgId Organization slug
 * @param {String} name Saved search name
 * @param {String} query Query to save
 *
 * @returns {Promise<Object>}
 */

export function createSavedSearch(api, orgId, name, query) {
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
 * @param {Object} api API client
 * @param {String} orgId Organization slug
 * @param {Number} type Context for where search happened, 0 for issue, 1 for event
 * @param {String} query A query term used to filter results
 *
 * @return {Object[]} Returns a list of objects of recent search queries performed by user
 */
export function fetchRecentSearches(api, orgId, type, query) {
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

const getPinSearchUrl = orgId => `/organizations/${orgId}/pinned-searches/`;

export function pinSearch(api, orgId, type, query) {
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

export function unpinSearch(api, orgId, type, pinnedSearch) {
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
    const {type: pinnedType, query, ...rest} = pinnedSearch;
    SavedSearchesActions.pinSearch(pinnedType, query, ...rest);
  });

  return promise;
}

/**
 * Send a DELETE request to remove a saved search
 *
 * @param {Object} api API client
 * @param {String} orgId Organization slug
 * @param {Object} search The search to remove.
 */
export function deleteSavedSearch(api, orgId, search) {
  const url = `/organizations/${orgId}/searches/${search.id}/`;

  const promise = api
    .requestPromise(url, {
      method: 'DELETE',
    })
    .then(() => SavedSearchesActions.deleteSavedSearchSuccess(search))
    .catch(handleXhrErrorResponse('Unable to delete a saved search'));

  return promise;
}
