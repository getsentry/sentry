/**
 * Get query term for API given location.search
 *
 * @param {String} search
 * @returns {Object}
 */

export function getQuery(query) {
  return {
    per_page: 50,
    cursor: query.cursor,
    query: query.query,
  };
}
