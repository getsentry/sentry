export function ServiceIncident(params = {}) {
  return {
    id: '1',
    title: 'Test Incident',
    createdAt: '2022-05-23T13:33:38.737-07:00',
    updates: [
      {
        name: 'First Update',
        updatedAt: '2022-05-23T13:33:38.737-07:00',
        body: 'Things look bad',
      },
      {
        name: 'Second Update',
        updatedAt: '2022-05-23T13:45:38.737-07:00',
        body: 'Investigating',
      },
    ],
    components: [
      {
        name: '',
        status: 'major_outage',
        updatedAt: '2022-05-23T13:33:38.737-07:00',
      },
      {
        name: 'Second Update',
        status: 'operational',
        updatedAt: '2022-05-23T13:45:38.737-07:00',
      },
    ],
    url: 'https://status.sentry.io',
    ...params,
  };
}
