/**
 * Top Errors by Device
 */
const topDevices = {
  fields: ['device.family'],
  conditions: [],
  aggregations: [['count()', null, 'count']],
  limit: 10,

  orderby: '-count',
  groupby: ['device.family'],
};

export default topDevices;
