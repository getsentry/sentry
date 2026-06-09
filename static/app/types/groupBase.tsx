import type {LocationDescriptor} from 'history';

import type {TimeseriesValue} from 'sentry/types/coreBase';
import type {EventMetadata, EventOrGroupType, Level} from 'sentry/types/eventBase';
import type {AvatarUser} from 'sentry/types/userBase';

export type EntryData = Record<string, any | any[]>;
/**
 * Saved issues searches
 */
export type RecentSearch = {
  dateCreated: string;
  id: string;
  lastSeen: string;
  organizationId: string;
  query: string;
  type: SavedSearchType;
};
// XXX: Deprecated Sentry 9 attributes are not included here.
export type SavedSearch = {
  dateCreated: string;
  id: string;
  isGlobal: boolean;
  isPinned: boolean;
  name: string;
  query: string;
  sort: string;
  type: SavedSearchType;
  visibility: SavedSearchVisibility;
};
export enum SavedSearchVisibility {
  ORGANIZATION = 'organization',
  OWNER = 'owner',
  OWNER_PINNED = 'owner_pinned',
}
export enum SavedSearchType {
  ISSUE = 0,
  EVENT = 1,
  SESSION = 2,
  REPLAY = 3,
  METRIC = 4,
  SPAN = 5,
  ERROR = 6,
  TRANSACTION = 7,
  LOG = 8,
  TRACEMETRIC = 9,
  PREPROD_APP_SIZE = 10,
  // This and src/sentry/models/search_common.py must be updated together.
}
export enum IssueCategory {
  ERROR = 'error',
  FEEDBACK = 'feedback',

  /**
   * @deprecated
   * Regression issues will move to the "metric" category
   * Other issues will move to "db_query"/"http_client"/"mobile"/"frontend"
   */
  PERFORMANCE = 'performance',
  /**
   * @deprecated
   * Cron issues will move to the "outage" category
   */
  CRON = 'cron',
  /**
   * @deprecated
   * Rage click and hydration issues will move to the "frontend" category
   */
  REPLAY = 'replay',
  /**
   * @deprecated
   * Uptime issues will move to the "outage" category
   */
  UPTIME = 'uptime',
  /**
   * @deprecated
   * Metric alert issues will move to the "metric" category
   */
  METRIC_ALERT = 'metric_alert',

  OUTAGE = 'outage',
  METRIC = 'metric',
  FRONTEND = 'frontend',
  HTTP_CLIENT = 'http_client',
  DB_QUERY = 'db_query',
  MOBILE = 'mobile',

  AI_DETECTED = 'ai_detected',

  PREPROD = 'preprod',

  CONFIGURATION = 'configuration',
}
export enum IssueType {
  // Error
  ERROR = 'error',

  // Performance
  PERFORMANCE_CONSECUTIVE_DB_QUERIES = 'performance_consecutive_db_queries',
  PERFORMANCE_CONSECUTIVE_HTTP = 'performance_consecutive_http',
  PERFORMANCE_FILE_IO_MAIN_THREAD = 'performance_file_io_main_thread',
  PERFORMANCE_DB_MAIN_THREAD = 'performance_db_main_thread',
  PERFORMANCE_N_PLUS_ONE_API_CALLS = 'performance_n_plus_one_api_calls',
  PERFORMANCE_N_PLUS_ONE_DB_QUERIES = 'performance_n_plus_one_db_queries',
  PERFORMANCE_SLOW_DB_QUERY = 'performance_slow_db_query',
  PERFORMANCE_RENDER_BLOCKING_ASSET = 'performance_render_blocking_asset_span',
  PERFORMANCE_UNCOMPRESSED_ASSET = 'performance_uncompressed_assets',
  PERFORMANCE_LARGE_HTTP_PAYLOAD = 'performance_large_http_payload',
  PERFORMANCE_HTTP_OVERHEAD = 'performance_http_overhead',
  PERFORMANCE_ENDPOINT_REGRESSION = 'performance_p95_endpoint_regression',

  // Profile
  PROFILE_FILE_IO_MAIN_THREAD = 'profile_file_io_main_thread',
  PROFILE_IMAGE_DECODE_MAIN_THREAD = 'profile_image_decode_main_thread',
  PROFILE_JSON_DECODE_MAIN_THREAD = 'profile_json_decode_main_thread',
  PROFILE_REGEX_MAIN_THREAD = 'profile_regex_main_thread',
  PROFILE_FRAME_DROP = 'profile_frame_drop',
  PROFILE_FUNCTION_REGRESSION = 'profile_function_regression',

  // Replay
  REPLAY_RAGE_CLICK = 'replay_click_rage',
  REPLAY_HYDRATION_ERROR = 'replay_hydration_error',

  // Monitors
  MONITOR_CHECK_IN_FAILURE = 'monitor_check_in_failure',

  // Uptime
  UPTIME_DOMAIN_FAILURE = 'uptime_domain_failure',

  // Metric Issues
  METRIC_ISSUE = 'metric_issue',

  // Detectors
  QUERY_INJECTION_VULNERABILITY = 'query_injection_vulnerability',

  // Insights Web Vitals
  WEB_VITALS = 'web_vitals',

  LLM_DETECTED_EXPERIMENTAL = 'llm_detected_experimental',
  LLM_DETECTED_EXPERIMENTAL_V2 = 'llm_detected_experimental_v2',
  AI_DETECTED_HTTP = 'ai_detected_http',
  AI_DETECTED_DB = 'ai_detected_db',
  AI_DETECTED_RUNTIME_PERFORMANCE = 'ai_detected_runtime_performance',
  AI_DETECTED_SECURITY = 'ai_detected_security',
  AI_DETECTED_CODE_HEALTH = 'ai_detected_code_health',
  AI_DETECTED_GENERAL = 'ai_detected_general',

  // Preprod
  PREPROD_STATIC = 'preprod_static',
  PREPROD_DELTA = 'preprod_delta',
  PREPROD_SIZE_ANALYSIS = 'preprod_size_analysis',

  // Configuration Issues
  SOURCEMAP_CONFIGURATION = 'sourcemap_configuration',
  LOW_VALUE_SPAN_CONFIGURATION = 'low_value_span_configuration',
}
export enum IssueTitle {
  ERROR = 'Error',

  // Performance
  PERFORMANCE_CONSECUTIVE_DB_QUERIES = 'Consecutive DB Queries',
  PERFORMANCE_CONSECUTIVE_HTTP = 'Consecutive HTTP',
  PERFORMANCE_FILE_IO_MAIN_THREAD = 'File IO on Main Thread',
  PERFORMANCE_DB_MAIN_THREAD = 'DB on Main Thread',
  PERFORMANCE_N_PLUS_ONE_API_CALLS = 'N+1 API Call',
  PERFORMANCE_N_PLUS_ONE_DB_QUERIES = 'N+1 Query',
  PERFORMANCE_SLOW_DB_QUERY = 'Slow DB Query',
  PERFORMANCE_RENDER_BLOCKING_ASSET = 'Large Render Blocking Asset',
  PERFORMANCE_UNCOMPRESSED_ASSET = 'Uncompressed Asset',
  PERFORMANCE_LARGE_HTTP_PAYLOAD = 'Large HTTP Payload',
  PERFORMANCE_HTTP_OVERHEAD = 'HTTP/1.1 Overhead',
  PERFORMANCE_ENDPOINT_REGRESSION = 'Endpoint Regression',

  // Profile
  PROFILE_FILE_IO_MAIN_THREAD = 'File I/O on Main Thread',
  PROFILE_IMAGE_DECODE_MAIN_THREAD = 'Image Decoding on Main Thread',
  PROFILE_JSON_DECODE_MAIN_THREAD = 'JSON Decoding on Main Thread',
  PROFILE_REGEX_MAIN_THREAD = 'Regex on Main Thread',
  PROFILE_FRAME_DROP = 'Frame Drop',
  PROFILE_FUNCTION_REGRESSION = 'Function Regression',

  // Replay
  REPLAY_RAGE_CLICK = 'Rage Click Detected',
  REPLAY_HYDRATION_ERROR = 'Hydration Error Detected',

  // Metric Issues
  METRIC_ISSUE = 'Issue Detected by Metric Monitor',

  // Monitors
  MONITOR_CHECK_IN_FAILURE = 'Missed or Failed Cron Check-In',

  // Uptime
  UPTIME_DOMAIN_FAILURE = 'Uptime Monitor Detected Downtime',

  QUERY_INJECTION_VULNERABILITY = 'Potential Query Injection Vulnerability',

  // Insights Web Vitals
  WEB_VITALS = 'Web Vitals',

  LLM_DETECTED_EXPERIMENTAL = 'LLM Detected Issue',
  LLM_DETECTED_EXPERIMENTAL_V2 = 'LLM Detected Issue V2',
  AI_DETECTED_HTTP = 'AI Detected HTTP Issue',
  AI_DETECTED_DB = 'AI Detected Database Issue',
  AI_DETECTED_RUNTIME_PERFORMANCE = 'AI Detected Runtime Performance Issue',
  AI_DETECTED_SECURITY = 'AI Detected Security Issue',
  AI_DETECTED_CODE_HEALTH = 'AI Detected Code Health Issue',
  AI_DETECTED_GENERAL = 'AI Detected Issue',

  PREPROD_STATIC = 'Static Analysis',
  PREPROD_DELTA = 'Static Analysis Delta',
  PREPROD_SIZE_ANALYSIS = 'Size Analysis',

  // Configuration Issues
  SOURCEMAP_CONFIGURATION = 'Missing or Broken Source Maps',
  LOW_VALUE_SPAN_CONFIGURATION = 'AI Detected Low-Value Span',
}
// endpoint: /api/0/organizations/:orgSlug/issues/:issueId/attachments/?limit=50
export type IssueAttachment = {
  dateCreated: string;
  event_id: string;
  headers: Record<PropertyKey, unknown>;
  id: string;
  mimetype: string;
  name: string;
  sha1: string;
  size: number;
  type: string;
};
// endpoint: /api/0/projects/:orgSlug/:projSlug/events/:eventId/attachments/
export type EventAttachment = IssueAttachment;
export type TagValue = {
  count: number;
  firstSeen: string;
  lastSeen: string;
  name: string;
  value: string;
  email?: string;
  identifier?: string;
  ipAddress?: string;
  key?: string;
  query?: string;
  username?: string;
} & AvatarUser;
type Topvalue = {
  count: number;
  firstSeen: string;
  key: string;
  lastSeen: string;
  name: string;
  value: string;
  // Might not actually exist.
  query?: string;
  readable?: string;
};
export type TagWithTopValues = {
  key: string;
  name: string;
  topValues: Topvalue[];
  totalValues: number;
  uniqueValues: number;
  canDelete?: boolean;
};
/**
 * Inbox, issue owners and Activity
 */
export type Annotation = {
  displayName: string;
  url: string;
};
type InboxReasonDetails = {
  count?: number | null;
  until?: string | null;
  user_count?: number | null;
  user_window?: number | null;
  window?: number | null;
};
const enum GroupInboxReason {
  NEW = 0,
  UNIGNORED = 1,
  REGRESSION = 2,
  MANUAL = 3,
  REPROCESSED = 4,
  ESCALATING = 5,
  ONGOING = 6,
}
export type InboxDetails = {
  date_added?: string;
  reason?: GroupInboxReason;
  reason_details?: InboxReasonDetails | null;
};
export type SuggestedOwnerReason =
  | 'suspectCommit'
  | 'ownershipRule'
  | 'projectOwnership'
  // TODO: codeowners may no longer exist
  | 'codeowners';
// Received from the backend to denote suggested owners of an issue
export type SuggestedOwner = {
  date_added: string;
  owner: string;
  type: SuggestedOwnerReason;
};
export enum GroupActivityType {
  NOTE = 'note',
  SET_RESOLVED = 'set_resolved',
  SET_RESOLVED_BY_AGE = 'set_resolved_by_age',
  SET_RESOLVED_IN_RELEASE = 'set_resolved_in_release',
  SET_RESOLVED_IN_COMMIT = 'set_resolved_in_commit',
  REFERENCED_IN_COMMIT = 'referenced_in_commit',
  SET_RESOLVED_IN_PULL_REQUEST = 'set_resolved_in_pull_request',
  SET_UNRESOLVED = 'set_unresolved',
  SET_IGNORED = 'set_ignored',
  SET_PUBLIC = 'set_public',
  SET_PRIVATE = 'set_private',
  SET_REGRESSION = 'set_regression',
  CREATE_ISSUE = 'create_issue',
  UNMERGE_SOURCE = 'unmerge_source',
  UNMERGE_DESTINATION = 'unmerge_destination',
  FIRST_SEEN = 'first_seen',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  MERGE = 'merge',
  REPROCESS = 'reprocess',
  MARK_REVIEWED = 'mark_reviewed',
  AUTO_SET_ONGOING = 'auto_set_ongoing',
  SET_ESCALATING = 'set_escalating',
  SET_PRIORITY = 'set_priority',
  DELETED_ATTACHMENT = 'deleted_attachment',
  SEER_RCA_STARTED = 'seer_rca_started',
  SEER_RCA_COMPLETED = 'seer_rca_completed',
  SEER_SOLUTION_STARTED = 'seer_solution_started',
  SEER_SOLUTION_COMPLETED = 'seer_solution_completed',
  SEER_CODING_STARTED = 'seer_coding_started',
  SEER_CODING_COMPLETED = 'seer_coding_completed',
  SEER_PR_CREATED = 'seer_pr_created',
}
interface GroupFiltered {
  count: string;
  firstSeen: string;
  lastSeen: string;
  stats: Record<string, TimeseriesValue[]>;
  userCount: number;
}
export interface GroupStats extends GroupFiltered {
  filtered: GroupFiltered | null;
  id: string;
  isUnhandled?: boolean;
  // for issue alert previews, the last time a group triggered a rule
  lastTriggered?: string;
  lifetime?: GroupFiltered;
  sessionCount?: string | null;
}
export interface IgnoredStatusDetails {
  actor?: AvatarUser;
  ignoreCount?: number;
  // Sent in requests. ignoreUntil is used in responses.
  ignoreDuration?: number;
  ignoreUntil?: string;
  ignoreUntilEscalating?: boolean;
  ignoreUserCount?: number;
  ignoreUserWindow?: number;
  ignoreWindow?: number;
}
export interface ReprocessingStatusDetails {
  info: {
    dateCreated: string;
    totalEvents: number;
  } | null;
  pendingEvents: number;
}
/**
 * The payload sent when marking reviewed
 */
export interface MarkReviewed {
  inbox: false;
}
export const enum GroupStatus {
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
  IGNORED = 'ignored',
  REPROCESSING = 'reprocessing',
}
export const enum GroupSubstatus {
  ARCHIVED_UNTIL_ESCALATING = 'archived_until_escalating',
  ARCHIVED_UNTIL_CONDITION_MET = 'archived_until_condition_met',
  ARCHIVED_FOREVER = 'archived_forever',
  ESCALATING = 'escalating',
  ONGOING = 'ongoing',
  REGRESSED = 'regressed',
  NEW = 'new',
}
export const enum PriorityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}
export const enum FixabilityScoreThresholds {
  SUPER_HIGH = 'super_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  SUPER_LOW = 'super_low',
}
export interface GroupOpenPeriodActivity {
  dateCreated: string;
  eventId: string | null;
  id: string;
  type: 'opened' | 'status_change' | 'closed';
  value: 'high' | 'medium' | null;
}
export interface GroupOpenPeriod {
  activities: GroupOpenPeriodActivity[];
  duration: string;
  end: string;
  id: string;
  isOpen: boolean;
  lastChecked: string;
  start: string;
}
export interface GroupTombstone {
  actor: AvatarUser;
  culprit: string;
  dateAdded: string | null;
  id: string;
  level: Level;
  metadata: EventMetadata;
  type: EventOrGroupType;
  lastSeen?: string;
  timesSeen?: number;
  title?: string;
}
export interface GroupTombstoneHelper extends GroupTombstone {
  isTombstone: true;
}
/**
 * Datascrubbing
 */
export type Meta = {
  chunks: ChunkType[];
  err: MetaError[];
  len: number;
  rem: MetaRemark[];
};
export type MetaError = string | [string, any];
type MetaRemark = Array<string | number>;
export type ChunkType = {
  rule_id: string | number;
  text: string;
  type: string;
  remark?: string | number;
};
export type KeyValueListDataItem = {
  key: string;
  subject: string;
  action?: {
    link?: LocationDescriptor;
  };
  actionButton?: React.ReactNode;
  /**
   * If true, the action button will always be visible, not just on hover.
   */
  actionButtonAlwaysVisible?: boolean;
  isContextData?: boolean;
  isMultiValue?: boolean;
  meta?: Meta;
  subjectDataTestId?: string;
  subjectIcon?: React.ReactNode;
  subjectNode?: React.ReactNode;
  value?: React.ReactNode | Record<string, string | number>;
};
export type KeyValueListData = KeyValueListDataItem[];
