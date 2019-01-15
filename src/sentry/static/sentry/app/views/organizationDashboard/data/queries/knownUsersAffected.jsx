/**
 * Known affected users
 */
const knownUsersAffectedQuery = {
  fields: [],
  conditions: [['user.email', 'IS NOT NULL', null]],
  aggregations: [['uniq', 'user.email', 'Known Users']],
  limit: 1000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default knownUsersAffectedQuery;
