import qs from 'query-string';

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
