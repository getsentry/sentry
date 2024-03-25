import type {ObjectStatus, Project} from 'sentry/types';
import type {ColorOrAlias} from 'sentry/utils/theme';

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
}

export enum CheckInStatus {
  OK = 'ok',
  ERROR = 'error',
  IN_PROGRESS = 'in_progress',
  MISSED = 'missed',
  TIMEOUT = 'timeout',
}

interface BaseConfig {
  /**
   * How long (in minutes) after the expected check-in time will we wait until
   * we consider the check-in to have been missed.
   */
  checkin_margin: number;
  /**
   * How long (in minutes) is the check-in allowed to run for in
   * CheckInStatus.IN_PROGRESS before it is considered failed.
   */
  max_runtime: number;
  /**
   * tz database style timezone string
   */
  timezone: string;
  alert_rule_id?: number;
  /**
   * How many consecutive missed or failed check-ins in a row before creating a
   * new issue.
   */
  failure_issue_threshold?: number | null;
  /**
   * How many successful check-ins in a row before resolving an issue.
   */
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

export interface MonitorEnvBrokenDetection {
  envMutedTimestamp: string;
  userNotifiedTimestamp: string;
}

export interface MonitorIncident {
  brokenNotice: MonitorEnvBrokenDetection | null;
  resolvingTimestamp: string;
  startingTimestamp: string;
}

export interface MonitorEnvironment {
  activeIncident: MonitorIncident | null;
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
  /**
   * Attachment ID for attachments sent via the legacy attachment HTTP
   * endpoint. This will likely be removed in the future.
   *
   * @deprecated
   */
  attachmentId: number | null;
  /**
   * Date the opening check-in was sent
   */
  dateCreated: string;
  /**
   * Duration (in milliseconds)
   */
  duration: number;
  /**
   * environment the check-in was sent to
   */
  environment: string;
  /**
   * What was the monitors nextCheckIn value when this check-in occured, this
   * is when we expected the check-in to happen.
   */
  expectedTime: string;
  /**
   * Check-in GUID
   */
  id: string;
  /**
   * Status of the check-in
   */
  status: CheckInStatus;
  /**
   * Groups associated to this check-in (determiend by traceId)
   */
  groups?: {id: number; shortId: string}[];
}

/**
 * Object used to store config for the display next to an environment in the timeline view
 */
export interface StatusNotice {
  color: ColorOrAlias;
  icon: React.ReactNode;
  label?: React.ReactNode;
}
