/**
 * Anonymous affected users
 */
const anonymousUsersAffectedQuery = {
  fields: [],
  conditions: [['user.email', 'IS NULL', null]],
  aggregations: [['count()', null, 'Anonymous Users']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default anonymousUsersAffectedQuery;
