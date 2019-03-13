/**
 * Events by Release
 */
import {t} from 'app/locale';

const eventsByRelease = {
  name: t('Events by Release'),
  fields: ['__release'],
  constraints: ['top10Releases'],
  conditions: [],
  aggregations: [['count()', null, 'Events']],
  limit: 5000,

  orderby: '-time',
  groupby: ['time', '__release'],
  rollup: 86400,
};

export {eventsByRelease};
export default eventsByRelease;

// const test = {
// orderby: '-time',
// consistent: false,
// aggregations: [['count()', null, 'count']],
// project: [1],
// from_date: '2019-02-26T23:10:27.180262',
// selected_columns: [
// [
// 'if',
// [
// [
// 'in',
// [
// 'tags[sentry:release]',
// 'tuple',
// ["'10828b2194ccaa8deeb49710a5eca007d43f552e'"],
// ],
// ],
// 'tags[sentry:release]',
// "'other'",
// ],
// 'release',
// ],
// ],
// limit: 1000,
// to_date: '2019-03-12T23:10:27.180262',
// granularity: 86400,
// conditions: [['project_id', 'IN', [1]]],
// groupby: ['time', 'release'],
// };

// const foo = {
// orderby: '-count',
// consistent: false,
// aggregations: [['count()', null, 'count']],
// project: [2],
// from_date: '2019-03-13T01:18:57',
// selected_columns: [
// [
// 'if',
// [
// ['in', ['tags[sentry:release]', 'tuple', ["'foo'"]]],
// 'tags[sentry:release]',
// "'other'",
// ],
// '_release',
// ],
// ],
// limit: 1000,
// to_date: '2019-03-13T01:19:07',
// granularity: 86400,
// conditions: [['project_id', 'IN', [2]]],
// groupby: ['time', 'tags[_release]'],
// };
