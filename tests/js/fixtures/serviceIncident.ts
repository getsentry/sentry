import {StatusPageComponent, type StatuspageIncident} from 'sentry/types/system';

export function ServiceIncidentFixture(
  params: Partial<StatuspageIncident> = {}
): StatuspageIncident {
  return {
    id: '1',
    page_id: '',
    status: 'unresolved',
    name: 'Test Incident',
    impact: 'major',
    monitoring_at: undefined,
    created_at: '2022-05-23T13:33:38.737-07:00',
    started_at: undefined,
    resolved_at: undefined,
    updated_at: undefined,
    incident_updates: [
      {
        id: '1',
        incident_id: '1',
        status: 'monitoring',
        body: 'Things look bad',
        affected_components: [],
        created_at: '2022-05-23T13:33:38.737-07:00',
        updated_at: '2022-05-23T13:33:38.737-07:00',
        display_at: '2022-05-23T13:33:38.737-07:00',
      },
      {
        id: '2',
        incident_id: '1',
        status: 'investigating',
        body: 'Investigating',
        affected_components: [],
        updated_at: '2022-05-23T13:45:38.737-07:00',
        created_at: '2022-05-23T13:45:38.737-07:00',
        display_at: '2022-05-23T13:45:38.737-07:00',
      },
    ],
    components: [
      {
        id: StatusPageComponent.US_ERRORS,
        page_id: '',
        position: 1,
        showcase: false,
        description: 'Errors ingestion',
        group: false,
        group_id: '1',
        only_show_if_degraded: false,
        name: '',
        status: 'major_outage',
        start_date: '2022-05-23',
        updated_at: '2022-05-23T13:33:38.737-07:00',
        created_at: '2022-05-23T13:33:38.737-07:00',
      },
    ],
    shortlink: 'https://status.sentry.io',
    ...params,
  };
}
