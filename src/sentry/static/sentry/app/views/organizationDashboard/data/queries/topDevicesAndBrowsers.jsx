/**
 * Top Errors by Device
 */
const topDevices = {
  fields: ['device.family', 'browser.name'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 10,
  groupby: [],
  orderby: '-count',
};

export default topDevices;
