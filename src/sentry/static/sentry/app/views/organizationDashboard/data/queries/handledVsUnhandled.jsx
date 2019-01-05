/**
 * Events by day
 */
const handledVsUnhandledQuery = {
  fields: ['error.handled'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 1000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default handledVsUnhandledQuery;
