import {pick} from 'lodash';
import qs from 'query-string';

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
    ...pick(query, [
      'cursor',
      'project',
      'environment',
      'statsPeriod',
      'start',
      'end',
      'utc',
    ]),
  };

  return queryParams;
}
