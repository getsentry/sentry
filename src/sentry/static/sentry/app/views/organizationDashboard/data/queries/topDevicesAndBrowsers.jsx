/**
 * Top Errors by Device
 */
const topDevices = {
  name: 'Top Devices',
  fields: ['device.family', 'browser.name'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 10,
  groupby: [],
  orderby: '-count',
};

export default topDevices;
