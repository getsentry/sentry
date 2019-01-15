/**
 * Events by day
 */
const events = {
  fields: [],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 1000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default events;
