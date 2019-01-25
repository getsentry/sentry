import {OPERATOR} from 'app/views/organizationDiscover/data';

/**
 * Top Errors by geo location
 */

const errorsByGeo = {
  name: 'Errors By Country',
  fields: ['geo.country_code'],
  conditions: [['geo.country_code', OPERATOR.IS_NOT_NULL, null]],
  aggregations: [['count()', null, 'count']],
  limit: 10,

  orderby: '-count',
  groupby: ['geo.country_code'],
};

export default errorsByGeo;
