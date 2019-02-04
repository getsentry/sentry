/**
 * Handled vs Unhandled Events
 */
import {t} from 'app/locale';

const handledVsUnhandledQuery = {
  name: t('Handled vs. Unhandled'),
  fields: ['error.handled'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default handledVsUnhandledQuery;
