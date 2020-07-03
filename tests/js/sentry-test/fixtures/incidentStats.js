export function IncidentStats(params) {
  return {
    totalEvents: 100,
    uniqueUsers: 20,
    eventStats: {
      data: [],
    },
    ...params,
  };
}
