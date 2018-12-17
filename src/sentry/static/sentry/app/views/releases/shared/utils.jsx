import {Client} from 'app/api';

/**
 * Fetch organization releases given the query filters.
 *
 * @param {Object} organization
 * @param {Object} query
 * @returns {Promise<Array>}
 */
export function fetchOrganizationReleases(organization, query) {
  const api = new Client();
  return api.requestPromise(`/organizations/${organization.slug}/releases/`, {query: {}});
}
