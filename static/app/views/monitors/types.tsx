import {ObjectStatus, Project} from 'sentry/types';

export enum MonitorType {
  UNKNOWN = 'unknown',
  CRON_JOB = 'cron_job',
}

/**
 * Some old monitor configuratiosn do NOT have a schedule_type
 *
 * TODO: This should be removed once we've cleaned up our old data and can
 *       verify we don't have any config objects missing schedule_type
 */
type LegacyDefaultSchedule = undefined;

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
  TIMEOUT = 'timeout',
}

export enum CheckInStatus {
  OK = 'ok',
  ERROR = 'error',
  IN_PROGRESS = 'in_progress',
  MISSED = 'missed',
  TIMEOUT = 'timeout',
}

interface BaseConfig {
  checkin_margin: number;
  max_runtime: number;
  timezone: string;
  alert_rule_id?: number;
}

/**
 * The configuration object used when the schedule is a CRONTAB
 */
export interface CrontabConfig extends BaseConfig {
  /**
   * The crontab schedule
   */
  schedule: string;
  schedule_type: ScheduleType.CRONTAB | LegacyDefaultSchedule;
}

/**
 * The configuration object used when the schedule is an INTERVAL
 */
export interface IntervalConfig extends BaseConfig {
  /**
   * The interval style schedule
   */
  schedule: [
    value: number,
    interval: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute'
  ];
  schedule_type: ScheduleType.INTERVAL;
}

export type MonitorConfig = CrontabConfig | IntervalConfig;

export interface MonitorEnvironment {
  dateCreated: string;
  lastCheckIn: string;
  name: string;
  nextCheckIn: string;
  status: MonitorStatus;
}

export interface Monitor {
  config: MonitorConfig;
  dateCreated: string;
  environments: MonitorEnvironment[];
  id: string;
  name: string;
  project: Project;
  slug: string;
  status: ObjectStatus;
  type: MonitorType;
}

export interface MonitorStat {
  duration: number;
  error: number;
  missed: number;
  ok: number;
  timeout: number;
  ts: number;
}

export interface CheckIn {
  dateCreated: string;
  duration: number;
  id: string;
  status: CheckInStatus;
  attachmentId?: number;
}
