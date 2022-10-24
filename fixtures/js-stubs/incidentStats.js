module.exports.IncidentStats = function (params = {}) {
  return {
    totalEvents: 100,
    uniqueUsers: 20,
    eventStats: {
      data: [],
    },
    ...params,
  };
};
