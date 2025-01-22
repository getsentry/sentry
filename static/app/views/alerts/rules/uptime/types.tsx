import type {Actor} from 'sentry/types/core';

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
  headers: [key: string, value: string][];
  id: string;
  intervalSeconds: number;
  method: string;
  mode: UptimeMonitorMode;
  name: string;
  owner: Actor;
  projectSlug: string;
  status: UptimeMonitorStatus;
  timeoutMs: number;
  traceSampling: boolean;
  url: string;
}
