/**
 * Top Errors by geo location
 */
const errorsByGeo = {
  fields: ['geo.country_code'],
  conditions: [['geo.country_code', 'IS NOT NULL', null]],
  aggregations: [['count()', null, 'count']],
  limit: 10,

  orderby: '-count',
  groupby: ['geo.country_code'],
};

export default errorsByGeo;
