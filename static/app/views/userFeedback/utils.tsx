import pick from 'lodash/pick';
import qs from 'query-string';

import {URL_PARAM} from 'sentry/constants/pageFilters';

/**
 * Get query for API given the current location.search string
 */
export function getQuery(search: string) {
  const query = qs.parse(search);
  const status = query.status !== undefined ? query.status : 'unresolved';

  return {
    status,
    ...pick(query, ['cursor', ...Object.values(URL_PARAM)]),
  };
}
