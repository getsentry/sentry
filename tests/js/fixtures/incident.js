export function Incident(params) {
  return {
    id: '123',
    identifier: '123',
    title: 'Too many Chrome errors',
    status: 0,
    projects: [],
    suspects: [],
    eventCount: 100,
    usersAffected: 20,
    isSubscribed: true,
    ...params,
  };
}
