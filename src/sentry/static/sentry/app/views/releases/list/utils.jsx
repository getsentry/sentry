import pick from 'lodash/pick';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';

/**
 * Get query term for API given location.query
 *
 * @param {String} search
 * @returns {Object}
 */
export function getQuery(query) {
  const validKeys = [...Object.values(URL_PARAM), 'cursor', 'query'];
  return {
    ...pick(query, validKeys),
    per_page: 50,
  };
}
