import type {GroupOpenPeriod} from 'sentry/types/group';

type GroupOpenPeriodActivity = GroupOpenPeriod['activities'][number];

const DEFAULT_ACTIVITY: GroupOpenPeriodActivity = {
  id: 'activity-1',
  type: 'opened',
  value: 'high',
  dateCreated: '2024-01-01T00:00:00Z',
};

const DEFAULT_OPEN_PERIOD: GroupOpenPeriod = {
  id: 'open-period-1',
  start: '2024-01-01T00:00:00Z',
  end: '2024-01-01T00:05:00Z',
  duration: '5m',
  eventId: 'event-1',
  isOpen: false,
  lastChecked: '2024-01-01T00:05:00Z',
  activities: [DEFAULT_ACTIVITY],
};

export function GroupOpenPeriodActivityFixture(
  params: Partial<GroupOpenPeriodActivity> = {}
): GroupOpenPeriodActivity {
  return {
    ...DEFAULT_ACTIVITY,
    ...params,
  };
}

export function GroupOpenPeriodFixture(
  params: Partial<GroupOpenPeriod> = {}
): GroupOpenPeriod {
  return {
    ...DEFAULT_OPEN_PERIOD,
    ...params,
    activities: params.activities ?? DEFAULT_OPEN_PERIOD.activities,
  };
}
