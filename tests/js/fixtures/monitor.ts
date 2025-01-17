import {
  type Monitor,
  MonitorStatus,
  ScheduleType,
} from 'sentry/views/monitors/types';

import {ActorFixture} from './actor';
import {ProjectFixture} from './project';

export function MonitorFixture(params: Partial<Monitor> = {}): Monitor {
  return {
    id: '',
    isMuted: false,
    name: 'My Monitor',
    project: ProjectFixture(),
    slug: 'my-monitor',
    status: 'active',
    owner: ActorFixture(),
    config: {
      checkin_margin: 5,
      max_runtime: 10,
      timezone: 'America/Los_Angeles',
      alert_rule_id: 1234,
      failure_issue_threshold: 2,
      recovery_threshold: 2,
      schedule_type: ScheduleType.CRONTAB,
      schedule: '10 * * * *',
    },
    dateCreated: '2023-01-01T00:00:00Z',
    environments: [
      {
        dateCreated: '2023-01-01T00:10:00Z',
        isMuted: false,
        lastCheckIn: '2023-12-25T17:13:00Z',
        name: 'production',
        nextCheckIn: '2023-12-25T16:10:00Z',
        nextCheckInLatest: '2023-12-25T15:15:00Z',
        status: MonitorStatus.OK,
        activeIncident: null,
      },
    ],
    alertRule: {
      targets: [{targetIdentifier: 1, targetType: 'Member'}],
    },
    ...params,
  };
}
