import {ObjectStatus, Project} from 'sentry/types';

export enum MonitorType {
  UNKNOWN = 'unknown',
  CRON_JOB = 'cron_job',
}

/**
 * Some old monitor configurations do NOT have a schedule_type
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
  failure_issue_threshold?: number | null;
  recovery_threshold?: number | null;
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
    interval: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute',
  ];
  schedule_type: ScheduleType.INTERVAL;
}

export type MonitorConfig = CrontabConfig | IntervalConfig;

export interface MonitorEnvironment {
  dateCreated: string;
  isMuted: boolean;
  lastCheckIn: string | null;
  name: string;
  nextCheckIn: string | null;
  nextCheckInLatest: string | null;
  status: MonitorStatus;
}

export interface Monitor {
  config: MonitorConfig;
  dateCreated: string;
  environments: MonitorEnvironment[];
  id: string;
  isMuted: boolean;
  name: string;
  project: Project;
  slug: string;
  status: ObjectStatus;
  type: MonitorType;
  alertRule?: {
    targets: Array<{
      targetIdentifier: number;
      targetType: 'Member' | 'Team';
    }>;
    environment?: string;
  };
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
  attachmentId: number | null;
  dateCreated: string;
  duration: number;
  environment: string;
  expectedTime: string;
  id: string;
  status: CheckInStatus;
  groups?: {id: number; shortId: string}[];
}
