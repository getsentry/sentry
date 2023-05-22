import type {customEvent, eventWithTime} from '@sentry-internal/rrweb/typings/types';
import type {Duration} from 'moment';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

// Keep this in sync with the backend blueprint
// "ReplayRecord" is distinct from the common: "replay = new ReplayReader()"
export type ReplayRecord = {
  /**
   * Number that represents how much user activity happened in a replay.
   */
  activity: number;
  browser: {
    name: null | string;
    version: null | string;
  };
  /**
   * The number of errors associated with the replay.
   */
  count_errors: number;
  /**
   * The number of segments that make up the replay.
   */
  count_segments: number;
  /**
   * The number of urls visited in the replay.
   */
  count_urls: number;
  device: {
    brand: null | string;
    family: null | string;
    model_id: null | string;
    name: null | string;
  };
  dist: null | string;
  /**
   * Difference of `finished_at` and `started_at` in seconds.
   */
  duration: Duration;
  environment: null | string;
  error_ids: string[];
  /**
   * The **latest** timestamp received as determined by the SDK.
   */
  finished_at: Date;
  /**
   * The ID of the Replay instance
   */
  id: string;
  /**
   * Whether the replay was deleted.
   * When deleted the rrweb data & attachments are removed from blob storage,
   * but the record of the replay is not removed.
   */
  is_archived: boolean;
  os: {
    name: null | string;
    version: null | string;
  };
  platform: string;
  project_id: string;
  releases: null | string[];
  sdk: {
    name: string;
    version: string;
  };
  /**
   * The **earliest** timestamp received as determined by the SDK.
   */
  started_at: Date;
  tags: Record<string, string[]>;
  trace_ids: string[];
  urls: string[];
  user: {
    display_name: null | string;
    email: null | string;
    id: null | string;
    ip: null | string;
    username: null | string;
  };
};

// The ReplayRecord fields, but with nested fields represented as `foo.bar`.
export type ReplayRecordNestedFieldName =
  | keyof ReplayRecord
  | `browser.${keyof ReplayRecord['browser']}`
  | `device.${keyof ReplayRecord['device']}`
  | `os.${keyof ReplayRecord['os']}`
  | `user.${keyof ReplayRecord['user']}`;

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

// Sync with REPLAY_LIST_FIELDS below
export type ReplayListRecord = Pick<
  ReplayRecord,
  | 'activity'
  | 'browser'
  | 'count_errors'
  | 'duration'
  | 'finished_at'
  | 'id'
  | 'is_archived'
  | 'os'
  | 'project_id'
  | 'started_at'
  | 'urls'
  | 'user'
>;

// Sync with ReplayListRecord above
export const REPLAY_LIST_FIELDS: ReplayRecordNestedFieldName[] = [
  'activity',
  'browser.name',
  'browser.version',
  'count_errors',
  'duration',
  'finished_at',
  'id',
  'is_archived',
  'os.name',
  'os.version',
  'project_id',
  'started_at',
  'urls',
  'user',
];

export type ReplaySegment = {
  dateAdded: string;
  projectId: string;
  replayId: string;
  segmentId: number;
};

/**
 * Highlight Replay Plugin types
 *
 * See also HighlightParams in static/app/components/replays/replayContext.tsx
 */
export interface Highlight {
  nodeId: number;
  text: string;
  color?: string;
}

export type RecordingEvent = eventWithTime;
export type RecordingOptions = customEvent<{
  blockAllMedia: boolean;
  errorSampleRate: number;
  maskAllInputs: boolean;
  maskAllText: boolean;
  networkCaptureBodies: boolean;
  networkDetailHasUrls: boolean;
  networkRequestHasHeaders: boolean;
  networkResponseHasHeaders: boolean;
  sessionSampleRate: number;
  useCompression: boolean;
  useCompressionOption: boolean;
}>;

export interface ReplaySpan<T = Record<string, any>> {
  data: T;
  endTimestamp: number;
  id: string;
  op: string;
  startTimestamp: number;
  timestamp: number;
  description?: string;
}

export type MemorySpan = ReplaySpan<{
  memory: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}>;

export type NetworkSpan = ReplaySpan;

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type ReplayCrumb = Overwrite<RawCrumb, {timestamp: number}>;

/**
 * This is a result of a custom discover query
 */
export interface ReplayError {
  ['error.type']: string[];
  ['error.value']: string[]; // deprecated, use title instead. See organization_replay_events_meta.py
  id: string;
  issue: string;
  ['issue.id']: number;
  ['project.name']: string;
  timestamp: string;
  title: string;
}
