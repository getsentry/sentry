import {
  Monitor as MonitorResponse,
  MonitorStatus,
  MonitorType,
  ScheduleType,
} from 'sentry/views/monitors/types';

import {Project} from './project';

export function Monitor(params: Partial<MonitorResponse> = {}): MonitorResponse {
  return {
    id: 'da28da7f-2ace-4b85-ac7a-ba753710896f',
    status: 'active',
    type: MonitorType.CRON_JOB,
    name: 'My Monitor',
    slug: 'my-monitor',
    config: {
      schedule: '0 0 * * *',
      checkin_margin: 5,
      max_runtime: 20,
      timezone: 'UTC',
      schedule_type: ScheduleType.CRONTAB,
    },
    dateCreated: '2023-05-17T03:18:01.046307Z',
    // @ts-expect-error Ignore should be removed once we fix the types of the
    // project stub fixture.
    project: Project(),
    environments: [
      {
        name: 'prod',
        status: MonitorStatus.ERROR,
        lastCheckIn: '2023-07-04T03:25:02Z',
        nextCheckIn: '2023-07-05T03:18:00Z',
        dateCreated: '2023-05-17T03:18:01.046307Z',
      },
    ],
    alertRule: undefined,
    ...params,
  };
}
