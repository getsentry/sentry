/**
 * Top Errors by Device and Browsers
 */
const topDevicesAndBrowsers = {
  name: 'Top Devices and Browsers',
  fields: ['device.family', 'browser.name'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 10,
  groupby: [],
  orderby: '-count',
};

export default topDevicesAndBrowsers;
