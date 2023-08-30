import {SentryServiceIncident} from 'sentry/types';

export function ServiceIncident(
  params: Partial<SentryServiceIncident> = {}
): SentryServiceIncident {
  return {
    id: '1',
    status: '',
    name: 'Test Incident',
    createdAt: '2022-05-23T13:33:38.737-07:00',
    updates: [
      {
        status: '',
        updatedAt: '2022-05-23T13:33:38.737-07:00',
        body: 'Things look bad',
      },
      {
        status: '',
        updatedAt: '2022-05-23T13:45:38.737-07:00',
        body: 'Investigating',
      },
    ],
    affectedComponents: [
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
