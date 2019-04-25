/**
 * Events by Release
 */
import {t} from 'app/locale';

const eventsByRelease = {
  name: t('Events by Release'),
  fields: ['release'],
  constraints: ['recentReleases'],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 5000,

  orderby: '-time',
  groupby: ['time', 'release'],
  rollup: 86400,
};

export default eventsByRelease;
