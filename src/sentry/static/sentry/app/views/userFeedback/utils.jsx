import {pick} from 'lodash';
import qs from 'query-string';

import {URL_PARAM} from 'app/components/organizations/globalSelectionHeader/constants';

const DEFAULT_STATUS = 'unresolved';

/**
 * Get query for API given the current location.search string
 *
 * @param {String} search
 * @returns {Object}
 */
export function getQuery(search) {
  const query = qs.parse(search);

  const status = typeof query.status !== 'undefined' ? query.status : DEFAULT_STATUS;

  const queryParams = {
    status,
    ...pick(query, ['cursor', ...Object.values(URL_PARAM)]),
  };

  return queryParams;
}
