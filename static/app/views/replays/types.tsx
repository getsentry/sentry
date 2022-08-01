import type {eventWithTime} from 'rrweb/typings/types';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

// Keep this in sync with the backend blueprint
// "ReplayRecord" is distinct from the common: "replay = new ReplayReader()"
export type ReplayRecord = {
  count_errors: number;
  count_segments: number;
  count_urls: number;
  dist: null | string;
  duration: number;
  environment: null | string;
  finished_at: Date; // API will send a string, needs to be hydrated
  longest_transaction: number;
  platform: string;
  project_id: string;
  project_slug: string;
  release: null | string;
  replay_id: string;
  sdk_name: string;
  sdk_version: string;
  started_at: Date; // API will send a string, needs to be hydrated
  tags: Record<string, string>;
  title: string;
  trace_ids: string[];
  urls: string[];
  user: {
    email: null | string;
    id: null | string;
    ip: null | string;
    name: null | string;
  };
};

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
 */
export type ReplayDurationAndErrors = {
  count_if_event_type_equals_error: number;
  'equation[0]': number;
  id: string;
  max_timestamp: string;
  min_timestamp: string;
  replayId: string;
};
