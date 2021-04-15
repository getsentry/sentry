import {Project} from 'app/types';

export type Status = 'ok' | 'error' | 'disabled' | 'active';

export type MonitorTypes = 'cron_job';

export type ScheduleType = 'crontab' | 'interval';

export type MonitorConfig = {
  checkin_margin: number;
  schedule_type: ScheduleType;
  max_runtime: number;
  schedule: unknown[];
};

export type Monitor = {
  status: Status;
  project: Project;
  name: string;
  lastCheckIn: string;
  config: MonitorConfig;
  nextCheckIn: string;
  type: MonitorTypes;
  id: string;
  dateCreated: string;
};

export type MonitorStat = {
  ts: number;
  ok: number;
  error: number;
};
