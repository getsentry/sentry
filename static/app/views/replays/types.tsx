import type {Duration} from 'moment';

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
  /**
   * The number of dead clicks associated with the replay.
   */
  count_dead_clicks?: number;
  /**
   * The number of rage clicks associated with the replay.
   */
  count_rage_clicks?: number;
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

// Sync with ReplayListRecord below
export const REPLAY_LIST_FIELDS = [
  'activity',
  'browser.name',
  'browser.version',
  'count_dead_clicks',
  'count_errors',
  'count_rage_clicks',
  'duration',
  'finished_at',
  'id',
  'is_archived',
  'os.name',
  'os.version',
  'project_id',
  'started_at',
  'user',
];

// Sync with REPLAY_LIST_FIELDS above
export type ReplayListRecord = Pick<
  ReplayRecord,
  | 'activity'
  | 'browser'
  | 'count_dead_clicks'
  | 'count_errors'
  | 'count_rage_clicks'
  | 'duration'
  | 'finished_at'
  | 'id'
  | 'is_archived'
  | 'os'
  | 'project_id'
  | 'started_at'
  | 'user'
>;

export type ReplaySegment = {
  dateAdded: string;
  projectId: string;
  replayId: string;
  segmentId: number;
};

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

export type DeadRageSelectorItem = {
  aria_label: string;
  dom_element: {fullSelector: string; projectId: number; selector: string};
  element: string;
  project_id: number;
  count_dead_clicks?: number;
  count_rage_clicks?: number;
};

export type DeadRageSelectorListResponse = {
  data: {
    count_dead_clicks: number;
    count_rage_clicks: number;
    dom_element: string;
    element: ReplayClickElement;
    project_id: number;
  }[];
};

export type ReplayClickElement = {
  alt: string;
  aria_label: string;
  class: string[];
  id: string;
  role: string;
  tag: string;
  testid: string;
  title: string;
};

export interface DeadRageSelectorQueryParams {
  isWidgetData: boolean;
  cursor?: string | string[] | undefined | null;
  per_page?: number;
  prefix?: string;
  sort?:
    | 'count_dead_clicks'
    | '-count_dead_clicks'
    | 'count_rage_clicks'
    | '-count_rage_clicks';
}
