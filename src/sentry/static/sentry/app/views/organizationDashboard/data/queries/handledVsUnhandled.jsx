/**
 * Handled vs Unhandled Events
 */
const handledVsUnhandledQuery = {
  name: 'Handled vs. Unhandled',
  fields: ['error.handled'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default handledVsUnhandledQuery;
