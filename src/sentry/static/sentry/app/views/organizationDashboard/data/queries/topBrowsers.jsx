/**
 * Top Errors by Browser
 */
const topBrowsers = {
  fields: ['browser.name'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 10,

  orderby: '-count',
  groupby: ['browser.name'],
};

export default topBrowsers;
