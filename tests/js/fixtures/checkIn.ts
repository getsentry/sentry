import type {CheckIn} from 'sentry/views/insights/crons/types';
import {CheckInStatus, ScheduleType} from 'sentry/views/insights/crons/types';

export function CheckInFixture(params: Partial<CheckIn> = {}): CheckIn {
  return {
    status: CheckInStatus.ERROR,
    duration: 9050,
    environment: 'production',
    dateAdded: '2025-01-01T00:00:01Z',
    dateCreated: '2025-01-01T00:00:05Z',
    dateUpdated: '2025-01-01T00:00:10Z',
    dateClock: '2025-01-01T00:00:00Z',
    dateInProgress: '2025-01-01T00:00:00Z',
    expectedTime: '2025-01-01T00:00:00Z',
    id: '97f0e440-317c-5bb5-b5e0-024ca202a61d',
    monitorConfig: {
      checkin_margin: 5,
      max_runtime: 10,
      timezone: 'America/Los_Angeles',
      alert_rule_id: 1234,
      failure_issue_threshold: 2,
      recovery_threshold: 2,
      schedule: '0 0 * * *',
      schedule_type: ScheduleType.CRONTAB,
    },
    ...params,
  };
}
