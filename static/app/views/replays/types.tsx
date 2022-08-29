import type {eventWithTime} from 'rrweb/typings/types';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

// Keep this in sync with the backend blueprint
// "ReplayRecord" is distinct from the common: "replay = new ReplayReader()"
export type ReplayRecord = {
  browser: {
    name: null | string;
    version: null | string;
  };
  /**
   * The number of errors associated with the replay.
   */
  countErrors: number;
  /**
   * The number of segments that make up the replay.
   */
  countSegments: number;
  /**
   * The number of urls visited in the replay.
   */
  countUrls: number;
  device: {
    brand: null | string;
    family: null | string;
    model: null | string;
    name: null | string;
  };
  dist: null | string;
  /**
   * Difference of `updated-at` and `created-at` in seconds.
   */
  duration: number; // Seconds
  environment: null | string;
  errorIds: string[];
  /**
   * The **latest** timestamp received as determined by the SDK.
   */
  finishedAt: Date;
  /**
   * The ID of the Replay instance
   */
  id: string;
  /**
   * The longest transaction associated with the replay measured in milliseconds.
   */
  longestTransaction: number;
  os: {
    name: null | string;
    version: null | string;
  };
  platform: string;
  projectId: string;
  release: null | string;
  sdk: {
    name: string;
    version: string;
  };
  /**
   * The **earliest** timestamp received as determined by the SDK.
   */
  startedAt: Date;
  tags: Record<string, string>;
  title: string;
  traceIds: string[];
  urls: string[];
  user: {
    email: string;
    id: string;
    ip_address: string;
    name: string;
    username: string;
  };
  userAgent: string;
};

export type ReplayListLocationQuery = {
  cursor?: string;
  end?: string;
  environment?: string[];
  field?: string[];
  limit?: string;
  offset?: string;
  project?: string[];
  query?: string;
  sort?: string;
  start?: string;
  statsPeriod?: string;
  utc?: 'true' | 'false';
};

export type ReplayListRecord = Pick<
  ReplayRecord,
  | 'countErrors'
  | 'duration'
  | 'finishedAt'
  | 'id'
  | 'projectId'
  | 'startedAt'
  | 'urls'
  | 'user'
>;

export type ReplaySegment = {
  dateAdded: string;
  projectId: string;
  replayId: string;
  segmentId: number;
};

/**
 * Highlight Replay Plugin types
 */
export interface Highlight {
  nodeId: number;
  text: string;
  color?: string;
}

export type RecordingEvent = eventWithTime;

export interface ReplaySpan<T = Record<string, any>> {
  data: T;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  description?: string;
}

export type MemorySpanType = ReplaySpan<{
  memory: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}>;

export type ReplayCrumb = RawCrumb & {
  /**
   * Replay crumbs are unprocessed and come in as unix timestamp in seconds
   */
  timestamp: number;
};

/**
 * This is a result of a custom discover query
 */
export interface ReplayError {
  ['error.type']: string;
  ['error.value']: string;
  id: string;
  ['issue.id']: number;
  ['project.name']: string;
  timestamp: string;
}
