import {OPERATOR} from 'app/views/organizationDiscover/data';

/**
 * Known affected users
 */

const knownUsersAffectedQuery = {
  name: 'Known Users',
  fields: [],
  conditions: [['user.email', OPERATOR.IS_NOT_NULL, null]],
  aggregations: [['uniq', 'user.email', 'Known Users']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default knownUsersAffectedQuery;
