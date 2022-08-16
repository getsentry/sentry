import type {eventWithTime} from 'rrweb/typings/types';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

// Keep this in sync with the backend blueprint
// "ReplayRecord" is distinct from the common: "replay = new ReplayReader()"
export type ReplayRecord = {
  browser: {
    name: null | string;
    version: null | string;
  };
  countErrors: number;
  countSegments: number;
  countUrls: number;
  device: {
    brand: null | string;
    family: null | string;
    model: null | string;
    name: null | string;
  };
  dist: null | string;
  duration: number; // Seconds
  environment: null | string;
  errorIds: string[];
  finishedAt: Date; // API will send a string, needs to be hydrated
  id: string;
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
  startedAt: Date; // API will send a string, needs to be hydrated
  tags: Record<string, string>;
  title: string;
  traceIds: string[];
  urls: string[];
  user: {
    email: null | string;
    id: null | string;
    ip_address: null | string;
    name: null | string;
  };
  userAgent: string;
};

export type ReplaySegment = {
  dateAdded: string;
  projectId: string;
  replayId: string;
  segmentId: number;
};

/**
 * @deprecated
 */
export type ReplayDiscoveryListItem = {
  eventID: string;
  id: string;
  project: string;
  timestamp: string;
  url: string;
  'user.display': string;
  'user.email': string;
  'user.id': string;
  'user.ip_address': string;
  'user.name': string;
  'user.username': string;
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

/**
 * Replay custom discover query
 *
 * @deprecated
 */
export type ReplayDurationAndErrors = {
  count_if_event_type_equals_error: number;
  'equation[0]': number;
  id: string;
  max_timestamp: string;
  min_timestamp: string;
  replayId: string;
};
