import {Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';

import {Query} from './types';

/**
 * Takes an organization and query and tracks in Redash as discover.query.
 * Scrubs strings in conditions in case they contain sensitive customer data.
 *
 * @param {Object} organization Current organization
 * @param {Object} query Query that is sent to Snuba
 * @returns {Void}
 */
export function trackQuery(organization: Organization, query: Query) {
  const data: Query & {org_id: number} = {
    org_id: parseInt(organization.id, 10),
    projects: query.projects,
    fields: query.fields,
    aggregations: query.aggregations,
    orderby: query.orderby,
  };

  if (typeof query.limit === 'number') {
    data.limit = query.limit;
  }

  data.conditions =
    query.conditions &&
    query.conditions.map(condition => [
      condition[0],
      condition[1],
      typeof condition[2] === 'string' ? '[REDACTED]' : condition[2],
    ]);

  analytics('discover.query', data);
}
