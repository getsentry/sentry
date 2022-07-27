import type {eventWithTime} from 'rrweb/typings/types';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

export type Replay = {
  count_errors: number;
  count_sequences: number;
  count_urls: number;
  dist: null | string;
  duration: number;
  environment: string;
  finished_at: Date;
  ip_address_v4: string;
  ip_address_v6: null | string;
  longest_transaction: number;
  platform: string;
  project_id: string;
  release: string;
  replay_id: string;
  sdk_name: string;
  sdk_version: string;
  started_at: Date;
  tags: Record<string, any>;
  title: string;
  trace_ids: string[];
  urls: string[];
  user: string;
  user_email: string;
  user_hash: string;
  user_id: string;
  user_name: string;
};

export type ReplaySegment = {
  date_added: Date;
  id: string;
  project_id: number;
  replay_id: string;
  segment_id: number;
};

export type DiscoReplayListItem = {
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
