import {Project} from 'sentry/types';

export type Status = 'ok' | 'error' | 'disabled' | 'active';

export type MonitorTypes = 'cron_job';

export type ScheduleType = 'crontab' | 'interval';

export type MonitorConfig = {
  checkin_margin: number;
  max_runtime: number;
  schedule: unknown[];
  schedule_type: ScheduleType;
};

export type Monitor = {
  config: MonitorConfig;
  dateCreated: string;
  id: string;
  lastCheckIn: string;
  name: string;
  nextCheckIn: string;
  project: Project;
  status: Status;
  type: MonitorTypes;
};

export type MonitorStat = {
  duration: number;
  error: number;
  ok: number;
  ts: number;
};
