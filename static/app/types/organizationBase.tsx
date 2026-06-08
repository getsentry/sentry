import type {Avatar, ObjectStatus} from 'sentry/types/coreBase';

export interface OrganizationSummary {
  avatar: Avatar;
  dateCreated: string;
  hideAiFeatures: boolean;
  id: string;
  isEarlyAdopter: boolean;
  issueAlertsThreadFlag: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  metricAlertsThreadFlag: boolean;
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: ObjectStatus;
    name: string;
  };
}
export interface MissingMember {
  commitCount: number;
  email: string;
  // The user's ID in the repository provider (e.g. Github username)
  externalId: string;
}
export type SharedViewOrganization = {
  slug: string;
  features?: string[];
  name?: string;
};
export type SavedQueryVersions = 1 | 2;
export type Confidence = 'high' | 'low' | null;
export type EventsStatsData = Array<
  [number, Array<{count: number; comparisonCount?: number}>]
>;
export type ConfidenceStatsData = Array<[number, Array<{count: Confidence}>]>;
type AccuracyStatsItem<T> = {
  timestamp: number;
  value: T;
};
export type AccuracyStats<T> = Array<AccuracyStatsItem<T>>;
export type EventsStatsSeries<F extends string> = {
  data: Array<{
    axis: F;
    values: number[];
    label?: string;
  }>;
  meta: {
    dataset: string;
    end: number;
    start: number;
  };
  timestamps: number[];
};
export interface SeriesApi {
  groups: Array<{
    by: Record<string, string | number>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }>;
  intervals: string[];
}
export interface SessionApiResponse extends SeriesApi {
  end: string;
  query: string;
  start: string;
}
export enum SessionFieldWithOperation {
  SESSIONS = 'sum(session)',
  USERS = 'count_unique(user)',
  DURATION = 'p50(session.duration)',
  CRASH_FREE_RATE_USERS = 'crash_free_rate(user)',
  CRASH_FREE_RATE_SESSIONS = 'crash_free_rate(session)',
}
export enum SessionStatus {
  HEALTHY = 'healthy',
  ABNORMAL = 'abnormal',
  ERRORED = 'errored',
  UNHANDLED = 'unhandled',
  CRASHED = 'crashed',
}
