import {Client} from 'app/api';
import qs from 'query-string';

/**
 * Fetch organization releases given the query filters.
 *
 * @param {String} orgId
 * @param {Object} query
 * @returns {Promise<Array>}
 */
export function fetchOrganizationReleases(orgId, query) {
  const api = new Client();

  return api.requestPromise(`/organizations/${orgId}/releases/`, {
    includeAllArgs: true,
    query,
  });
}

/**
 * Get query term for API given location.search
 *
 * @param {String} search
 * @returns {Object}
 */

export function getQuery(search) {
  const query = qs.parse(search);

  return {
    per_page: 50,
    cursor: query.cursor,
    query: query.query,
  };
}
