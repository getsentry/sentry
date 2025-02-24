import type {Actor, ObjectStatus} from 'sentry/types/core';

export enum UptimeMonitorStatus {
  OK = 1,
  FAILED = 2,
}

export enum UptimeMonitorMode {
  MANUAL = 1,
  AUTO_DETECTED_ONBOARDING = 2,
  AUTO_DETECTED_ACTIVE = 3,
}

export interface UptimeRule {
  body: string | null;
  environment: string | null;
  headers: Array<[key: string, value: string]>;
  id: string;
  intervalSeconds: number;
  method: string;
  mode: UptimeMonitorMode;
  name: string;
  owner: Actor;
  projectSlug: string;
  status: ObjectStatus;
  timeoutMs: number;
  traceSampling: boolean;
  uptimeStatus: UptimeMonitorStatus;
  url: string;
}

export interface UptimeCheck {
  checkStatus: CheckStatus;
  checkStatusReason: CheckStatusReason | null;
  durationMs: number;
  environment: string;
  httpStatusCode: number | null;
  projectUptimeSubscriptionId: number;
  region: string;
  regionName: string;
  scheduledCheckTime: string;
  timestamp: string;
  traceId: string;
  uptimeCheckId: string;
  uptimeSubscriptionId: number;
}

export enum CheckStatusReason {
  FAILURE = 'failure',
  TIMEOUT = 'timeout',
  DNS_ERROR = 'dns_error',
  TLS_ERROR = 'tls_error',
  CONNECTION_ERROR = 'connection_error',
}

export enum CheckStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  FAILURE_INCIDENT = 'failure_incident',
  MISSED_WINDOW = 'missed_window',
}

type StatsBucket = {
  [CheckStatus.SUCCESS]: number;
  [CheckStatus.FAILURE]: number;
  [CheckStatus.FAILURE_INCIDENT]: number;
  [CheckStatus.MISSED_WINDOW]: number;
};

export type CheckStatusBucket = [timestamp: number, stats: StatsBucket];
