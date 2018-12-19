import {Client} from 'app/api';
import qs from 'query-string';

const DEFAULT_STATUS = 'unresolved';

/**
 * Fetch user feedback for organization filtered by the query provided.
 * Either statsPeriod or start, end and utc values should be provided.
 *
 * @param {Object} organization
 * @param {Object} query
 * @param {Number[]} query.projects
 * @param {String[]} query.environments
 * @param {String} [query.statsPeriod]
 * @param {String} [query.start]
 * @param {String} [query.end]
 * @param {Boolean} [query.utc]
 * @returns {Promise<Array>}
 */
export function fetchUserFeedback(organization, query = {}) {
  const api = new Client();

  return api.requestPromise(`/organizations/${organization.slug}/user-feedback/`, {
    includeAllArgs: true,
    query: {
      per_page: 50,
      ...query,
    },
  });
}

/**
 * Get query for API given the current location.search string
 * We are using qs.parse since location.query re-uses the same object making it
 * incorrectly seem like the query string has not changed
 *
 * @param {String} search
 * @returns {Object}
 */
export function getQuery(search) {
  const query = qs.parse(search);

  const status = typeof query.status !== 'undefined' ? query.status : DEFAULT_STATUS;
  const cursor = query.cursor;

  const queryParams = {status, cursor};

  return queryParams;
}
