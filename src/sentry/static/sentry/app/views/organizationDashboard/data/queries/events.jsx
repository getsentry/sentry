/**
 * Events by day
 */
const events = {
  name: 'Events',
  fields: [],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default events;
