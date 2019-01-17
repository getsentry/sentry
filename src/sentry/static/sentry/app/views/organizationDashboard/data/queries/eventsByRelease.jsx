/**
 * Events by Release
 */
const eventsByRelease = {
  fields: ['release'],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default eventsByRelease;
