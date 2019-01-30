/**
 * Events by Release
 */
import {t} from 'app/locale';

const eventsByRelease = {
  name: t('Events by Release'),
  fields: ['release'],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 2000,

  orderby: '-time',
  groupby: ['time'],
  rollup: 86400,
};

export default eventsByRelease;
