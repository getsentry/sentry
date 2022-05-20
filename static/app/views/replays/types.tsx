import type {eventWithTime} from 'rrweb/typings/types';

import type {RawCrumb} from 'sentry/types/breadcrumbs';

export type Replay = {
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

export enum ReplayTabs {
  CONSOLE = 'console',
  NETWORK = 'network',
  TRACE = 'trace',
  ISSUES = 'issues',
  TAGS = 'tags',
  MEMORY = 'memory',
}

export function isReplayTab(tab: string): tab is ReplayTabs {
  return tab.toUpperCase() in ReplayTabs;
}

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
