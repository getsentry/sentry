import {OPERATOR} from 'app/views/organizationDiscover/data';
import {t} from 'app/locale';

/**
 * Top Errors by geo location
 */

const errorsByGeo = {
  name: t('Errors By Country'),
  fields: ['geo.country_code'],
  conditions: [['geo.country_code', OPERATOR.IS_NOT_NULL, null]],
  aggregations: [['count()', null, 'count']],
  limit: 10,

  orderby: '-count',
  groupby: ['geo.country_code'],
};

export default errorsByGeo;
