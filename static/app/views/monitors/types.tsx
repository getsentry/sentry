import {Project} from 'sentry/types';

export enum MonitorType {
  CRON_JOB = 'cron_job',
  // XXX(epurkhiser): There are 3 other types defined in the backend. But right
  // now we've only implemented a frontend for the CRON_JOB type
  HEALTH_CHECK = 'health_check',
  HEARTBEAT = 'heartbeat',
  UNKNOWN = 'unknown',
}

export enum ScheduleType {
  CRONTAB = 'crontab',
  INTERVAL = 'interval',
}

export enum MonitorStatus {
  OK = 'ok',
  ERROR = 'error',
  DISABLED = 'disabled',
  ACTIVE = 'active',
  MISSED_CHECKIN = 'missed_checkin',
}

export enum CheckInStatus {
  OK = 'ok',
  ERROR = 'error',
  IN_PROGRESS = 'in_progress',
  MISSED = 'missed',
}

export interface MonitorConfig {
  checkin_margin: number;
  max_runtime: number;
  schedule: unknown[];
  schedule_type: ScheduleType;
  timezone: string;
}

export interface Monitor {
  config: MonitorConfig;
  dateCreated: string;
  id: string;
  lastCheckIn: string;
  name: string;
  nextCheckIn: string;
  project: Project;
  status: MonitorStatus;
  type: MonitorType;
}

export interface MonitorStat {
  duration: number;
  error: number;
  missed: number;
  ok: number;
  ts: number;
}
