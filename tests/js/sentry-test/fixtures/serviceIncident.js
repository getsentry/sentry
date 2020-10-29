export function ServiceIncident(params = {}) {
  return {
    id: '1',
    title: 'Test Incident',
    updates: ['First Update', 'Second Update'],
    url: 'https://status.sentry.io',
    ...params,
  };
}
