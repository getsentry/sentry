import type {Duration} from 'moment-timezone';

type Geo = Record<string, string>;
// Geo could be this, not sure:
// {
//   city?: string;
//   country_code?: string;
//   region?: string;
//   subdivision?: string;
// };

// Keep this in sync with the backend blueprint
// "ReplayRecord" is distinct from the common: "replay = new ReplayReader()"
export type HydratedReplayRecord = {
  /**
   * Number that represents how much user activity happened in a replay.
   */
  activity: number;
  browser: {
    name: null | string;
    version: null | string;
  };
  clicks: Array<{
    ['click.alt']: string | null;
    ['click.class']: string | null;
    ['click.component_name']: string | null;
    ['click.id']: string | null;
    ['click.label']: string | null;
    ['click.role']: string | null;
    ['click.tag']: string | null;
    ['click.testid']: string | null;
    ['click.text']: string | null;
    ['click.title']: string | null;
  }>;
  /**
   * The number of dead clicks associated with the replay.
   */
  count_dead_clicks: number;
  /**
   * The number of errors associated with the replay.
   */
  count_errors: number;
  /**
   * The number of infos associated with the replay.
   */
  count_infos: number;
  /**
   * The number of rage clicks associated with the replay.
   */
  count_rage_clicks: number;
  /**
   * The number of segments that make up the replay.
   */
  count_segments: number;
  /**
   * The number of urls visited in the replay.
   */
  count_urls: number;
  /**
   * The number of warnings associated with the replay.
   */
  count_warnings: number;
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
  /**
   * The IDs of the errors associated with the replay.
   */
  error_ids: string[];
  /**
   * The **latest** timestamp received as determined by the SDK.
   */
  finished_at: Date;
  /**
   * Whether the currently authenticated user has seen this replay or not.
   */
  has_viewed: boolean;
  /**
   * The ID of the Replay instance
   */
  id: string;
  /**
   * The IDs of the infos associated with the replay.
   */
  info_ids: string[];
  /**
   * Whether the replay was deleted.
   * When deleted the rrweb data & attachments are removed from blob storage,
   * but the record of the replay is not removed.
   */
  is_archived: false;
  os: {
    name: null | string;
    version: null | string;
  };
  ota_updates: {
    channel: string;
    runtime_version: string;
    update_id: string;
  };
  platform: string;
  project_id: string;
  releases: null | string[];
  replay_type: 'buffer' | 'session';
  sdk: {
    name: null | string;
    version: null | string;
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
    geo?: Geo;
  };
  warning_ids: string[];
};
type ArchivedReplayRecord = {
  activity: null;
  browser: {
    name: null;
    version: null;
  };
  clicks: never[];
  count_dead_clicks: null;
  count_errors: null;
  count_infos: null;
  count_rage_clicks: null;
  count_segments: null;
  count_urls: null;
  count_warnings: null;
  device: {
    brand: null;
    family: null;
    model_id: null;
    name: null;
  };
  dist: null;
  duration: null;
  environment: null;
  error_ids: never[];
  finished_at: null;
  has_viewed: null;
  id: string;
  info_ids: never[];
  is_archived: true;
  os: {
    name: null;
    version: null;
  };
  ota_updates: Record<string, never>;
  platform: null;
  project_id: null;
  releases: never[];
  replay_type: null;
  sdk: {
    name: null;
    version: null;
  };
  started_at: null;
  tags: Record<string, string[]>;
  trace_ids: never[];
  urls: never[];
  user: {
    display_name: 'Archived User';
    email: null;
    id: 'Archived User';
    ip: null;
    username: null;
    geo?: Geo;
  };
  warning_ids: never[];
};
export type ReplayRecord = HydratedReplayRecord | ArchivedReplayRecord;

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

export type ReplayListQueryReferrer =
  | 'replayList'
  | 'issueReplays'
  | 'transactionReplays';

// Sync with ReplayListRecord below
export const REPLAY_LIST_FIELDS = [
  'activity',
  'browser.name',
  'browser.version',
  'count_dead_clicks',
  'count_errors',
  'count_infos',
  'count_rage_clicks',
  'count_segments',
  'count_urls',
  'count_warnings',
  'device.brand',
  'device.family',
  'device.model_id',
  'device.name',
  'dist',
  'duration',
  'environment',
  'error_ids',
  'finished_at',
  'has_viewed',
  'id',
  'info_ids',
  'is_archived',
  'os.name',
  'os.version',
  'ota_updates.channel',
  'ota_updates.runtime_version',
  'ota_updates.update_id',
  'platform',
  'project_id',
  'releases',
  'replay_type',
  'sdk.name',
  'sdk.version',
  'started_at',
  'tags',
  'trace_ids',
  'urls',
  'user',
  'warning_ids',
];

// Sync with REPLAY_LIST_FIELDS above
// TODO: Account for is_archived
export type ReplayListRecord = Pick<
  ReplayRecord,
  | 'activity'
  | 'browser'
  | 'clicks'
  | 'count_dead_clicks'
  | 'count_errors'
  | 'count_infos'
  | 'count_rage_clicks'
  | 'count_segments'
  | 'count_urls'
  | 'count_warnings'
  | 'device'
  | 'dist'
  | 'duration'
  | 'environment'
  | 'error_ids'
  | 'finished_at'
  | 'has_viewed'
  | 'id'
  | 'info_ids'
  | 'is_archived'
  | 'os'
  | 'ota_updates'
  | 'platform'
  | 'project_id'
  | 'releases'
  | 'replay_type'
  | 'sdk'
  | 'started_at'
  | 'tags'
  | 'trace_ids'
  | 'urls'
  | 'user'
  | 'warning_ids'
>;

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
  dom_element: {
    fullSelector: string;
    projectId: number;
    selector: string;
  };
  element: string;
  project_id: number;
  count_dead_clicks?: number;
  count_rage_clicks?: number;
};

export type DeadRageSelectorListResponse = {
  data: Array<{
    count_dead_clicks: number;
    count_rage_clicks: number;
    dom_element: string;
    element: ReplayClickElement;
    project_id: number;
  }>;
};

export type ReplayClickElement = {
  alt: string;
  aria_label: string;
  class: string[];
  component_name: string;
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
