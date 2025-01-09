import type {Actor, ObjectStatus} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
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
  UNKNOWN = 'unknown',
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
  /**
   * The id of thee "shadow" alert rule generated when alert assignees are
   * selected
   */
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
  environmentMutedTimestamp: string;
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
  owner: Actor;
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
   * A snapshot of the monitor configuration at the time of the check-in
   */
  monitorConfig: MonitorConfig;
  /**
   * Status of the check-in
   */
  status: CheckInStatus;
  /**
   * Groups associated to this check-in (determiend by traceId)
   */
  groups?: {id: number; shortId: string}[];
}

type StatsBucket = {
  [CheckInStatus.IN_PROGRESS]: number;
  [CheckInStatus.OK]: number;
  [CheckInStatus.MISSED]: number;
  [CheckInStatus.TIMEOUT]: number;
  [CheckInStatus.ERROR]: number;
  [CheckInStatus.UNKNOWN]: number;
};

type MonitorBucketEnvMapping = Record<string, StatsBucket>;

export type MonitorBucket = [timestamp: number, envData: MonitorBucketEnvMapping];

/**
 * Object used to store config for the display next to an environment in the
 * timeline view
 */
export interface StatusNotice {
  color: ColorOrAlias;
  icon: React.ReactNode;
  label?: React.ReactNode;
}

// Derived from backend enum: /src/sentry/monitors/processing_errors/errors.py
export enum ProcessingErrorType {
  CHECKIN_ENVIRONMENT_MISMATCH = 0,
  CHECKIN_FINISHED = 1,
  CHECKIN_GUID_PROJECT_MISMATCH = 2,
  CHECKIN_INVALID_DURATION = 3,
  CHECKIN_INVALID_GUID = 4,
  CHECKIN_VALIDATION_FAILED = 5,
  MONITOR_DISABLED = 6,
  MONITOR_DISABLED_NO_QUOTA = 7,
  MONITOR_INVALID_CONFIG = 8,
  MONITOR_INVALID_ENVIRONMENT = 9,
  MONITOR_LIMIT_EXCEEDED = 10,
  MONITOR_NOT_FOUND = 11,
  MONITOR_OVER_QUOTA = 12,
  MONITOR_ENVIRONMENT_LIMIT_EXCEEDED = 13,
  MONITOR_ENVIRONMENT_RATELIMITED = 14,
  ORGANIZATION_KILLSWITCH_ENABLED = 15,
}

interface CheckinEnvironmentMismatch {
  existingEnvironment: string;
  type: ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH;
}

interface CheckinGuidProjectMismatch {
  guid: string;
  type: ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH;
}

interface CheckinInvalidDuration {
  duration: string;
  type: ProcessingErrorType.CHECKIN_INVALID_DURATION;
}

interface CheckinValidationFailed {
  errors: Record<string, string[]>;
  type: ProcessingErrorType.CHECKIN_VALIDATION_FAILED;
}

interface MonitorInvalidConfig {
  errors: Record<string, string[]>;
  type: ProcessingErrorType.MONITOR_INVALID_CONFIG;
}

interface MonitorInvalidEnvironment {
  reason: string;
  type: ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT;
}

interface MonitorLimitExceeded {
  reason: string;
  type: ProcessingErrorType.MONITOR_LIMIT_EXCEEDED;
}

interface MonitorEnvironmentLimitExceeded {
  reason: string;
  type: ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED;
}

type ProcessingErrorWithExtra =
  | CheckinEnvironmentMismatch
  | CheckinGuidProjectMismatch
  | CheckinInvalidDuration
  | CheckinValidationFailed
  | MonitorInvalidConfig
  | MonitorInvalidEnvironment
  | MonitorLimitExceeded
  | MonitorEnvironmentLimitExceeded;

interface SimpleProcessingError {
  type: Exclude<ProcessingErrorType, ProcessingErrorWithExtra['type']>;
}

export type ProcessingError = SimpleProcessingError | ProcessingErrorWithExtra;

export interface CheckInPayload {
  message: {
    message_type: 'check_in';
    payload: string;
    project_id: number;
    retention_days: number;
    sdk: string;
    start_time: number;
    type: 'check_in';
  };
  partition: number;
  payload: {
    check_in_id: string;
    environment: string;
    monitor_slug: string;
    status: string;
    monitor_config?: MonitorConfig;
  };
  ts: string;
}

export interface CheckinProcessingError {
  checkin: CheckInPayload;
  errors: ProcessingError[];
  id: string;
}
