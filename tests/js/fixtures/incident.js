export function Incident(params) {
  return {
    id: '321',
    identifier: '123',
    title: 'Too many Chrome errors',
    status: 0,
    projects: [],
    totalEvents: 100,
    uniqueUsers: 20,
    isSubscribed: true,
    ...params,
  };
}
