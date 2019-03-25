import {MAX_RECENT_SEARCHES, SEARCH_TYPES} from 'app/constants';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';

export function fetchSavedSearches(api, orgId, useOrgSavedSearches = false) {
  const url = `/organizations/${orgId}/searches/`;

  const data = {};
  if (useOrgSavedSearches) {
    data.use_org_level = '1';
  }

  return api.requestPromise(url, {
    method: 'GET',
    data,
  });
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
  return api.requestPromise(`/organizations/${orgId}/searches/`, {
    method: 'POST',
    data: {
      type: SEARCH_TYPES.ISSUE,
      query,
      name,
    },
  });
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
      limit: MAX_RECENT_SEARCHES,
    },
  });

  promise.catch(handleXhrErrorResponse('Unable to fetch recent searches'));

  return promise;
}

const getPinSearchUrl = orgId => `/organizations/${orgId}/pinned-searches/`;

export function pinSearch(api, orgId, query, type) {
  const url = getPinSearchUrl(orgId);
  const promise = api.requestPromise(url, {
    method: 'POST',
    data: {
      query,
      type,
    },
  });

  promise.catch(handleXhrErrorResponse('Unable to un-pin search'));

  return promise;
}

export function unpinSearch(api, orgId, type) {
  const url = getPinSearchUrl(orgId);
  const promise = api.requestPromise(url, {
    method: 'DELETE',
    query: {
      type,
    },
  });

  promise.catch(handleXhrErrorResponse('Unable to un-pin search'));

  return promise;
}

/**
 * Send a DELETE rquest to remove a saved search
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
    .catch(handleXhrErrorResponse('Unable to delete a saved search'));

  return promise;
}
