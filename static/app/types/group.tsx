import type {LocationDescriptor} from 'history';

import type {TitledPlugin} from 'sentry/components/group/pluginActions';
import type {SearchGroup} from 'sentry/components/searchBar/types';
import {t} from 'sentry/locale';
import type {FieldKind} from 'sentry/utils/fields';

import type {Actor, TimeseriesValue} from './core';
import type {Event, EventMetadata, EventOrGroupType, Level} from './event';
import type {
  AvatarSentryApp,
  Commit,
  ExternalIssue,
  PlatformExternalIssue,
  PullRequest,
  Repository,
} from './integrations';
import type {Team} from './organization';
import type {AvatarProject, PlatformKey, Project} from './project';
import type {AvatarUser, User} from './user';

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

  // New issue categories (under the issue-taxonomy flag)
  OUTAGE = 'outage',
  METRIC = 'metric',
  FRONTEND = 'frontend',
  HTTP_CLIENT = 'http_client',
  DB_QUERY = 'db_query',
  MOBILE = 'mobile',
}

/**
 * Valid issue categories for the new issue-taxonomy flag
 */
export const VALID_ISSUE_CATEGORIES_V2 = [
  IssueCategory.ERROR,
  IssueCategory.OUTAGE,
  IssueCategory.METRIC,
  IssueCategory.DB_QUERY,
  IssueCategory.HTTP_CLIENT,
  IssueCategory.FRONTEND,
  IssueCategory.MOBILE,
  IssueCategory.FEEDBACK,
];

export const ISSUE_CATEGORY_TO_DESCRIPTION: Record<IssueCategory, string> = {
  [IssueCategory.ERROR]: t('Runtime errors or exceptions.'),
  [IssueCategory.OUTAGE]: t('Uptime or cron monitoring issues.'),
  [IssueCategory.METRIC]: t('Performance regressions or metric threshold violations.'),
  [IssueCategory.FRONTEND]: t('Frontend performance or usability issues.'),
  [IssueCategory.HTTP_CLIENT]: t('Inefficient or problematic outgoing HTTP requests.'),
  [IssueCategory.DB_QUERY]: t('Inefficient or problematic database queries.'),
  [IssueCategory.MOBILE]: t('Mobile performance or usability issues.'),
  [IssueCategory.FEEDBACK]: t('Feedback submitted directly by users.'),
  [IssueCategory.METRIC_ALERT]: '',
  [IssueCategory.PERFORMANCE]: '',
  [IssueCategory.CRON]: '',
  [IssueCategory.REPLAY]: '',
  [IssueCategory.UPTIME]: '',
};

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
}

// Update this if adding an issue type that you don't want to show up in search!
export const VISIBLE_ISSUE_TYPES = Object.values(IssueType);

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
}

export const ISSUE_TYPE_TO_ISSUE_TITLE = {
  error: IssueTitle.ERROR,

  performance_consecutive_db_queries: IssueTitle.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
  performance_consecutive_http: IssueTitle.PERFORMANCE_CONSECUTIVE_HTTP,
  performance_file_io_main_thread: IssueTitle.PERFORMANCE_FILE_IO_MAIN_THREAD,
  performance_db_main_thread: IssueTitle.PERFORMANCE_DB_MAIN_THREAD,
  performance_n_plus_one_api_calls: IssueTitle.PERFORMANCE_N_PLUS_ONE_API_CALLS,
  performance_n_plus_one_db_queries: IssueTitle.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
  performance_slow_db_query: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
  performance_render_blocking_asset_span: IssueTitle.PERFORMANCE_RENDER_BLOCKING_ASSET,
  performance_uncompressed_assets: IssueTitle.PERFORMANCE_UNCOMPRESSED_ASSET,
  performance_large_http_payload: IssueTitle.PERFORMANCE_LARGE_HTTP_PAYLOAD,
  performance_http_overhead: IssueTitle.PERFORMANCE_HTTP_OVERHEAD,
  performance_p95_endpoint_regression: IssueTitle.PERFORMANCE_ENDPOINT_REGRESSION,

  profile_file_io_main_thread: IssueTitle.PROFILE_FILE_IO_MAIN_THREAD,
  profile_image_decode_main_thread: IssueTitle.PROFILE_IMAGE_DECODE_MAIN_THREAD,
  profile_json_decode_main_thread: IssueTitle.PROFILE_JSON_DECODE_MAIN_THREAD,
  profile_regex_main_thread: IssueTitle.PROFILE_REGEX_MAIN_THREAD,
  profile_frame_drop: IssueTitle.PROFILE_FRAME_DROP,
  profile_frame_drop_experimental: IssueTitle.PROFILE_FRAME_DROP,
  profile_function_regression: IssueTitle.PROFILE_FUNCTION_REGRESSION,

  query_injection_vulnerability: IssueTitle.QUERY_INJECTION_VULNERABILITY,

  replay_click_rage: IssueTitle.REPLAY_RAGE_CLICK,
  replay_hydration_error: IssueTitle.REPLAY_HYDRATION_ERROR,

  metric_issue: IssueTitle.METRIC_ISSUE,

  monitor_check_in_failure: IssueTitle.MONITOR_CHECK_IN_FAILURE,
  uptime_domain_failure: IssueTitle.UPTIME_DOMAIN_FAILURE,

  web_vitals: IssueTitle.WEB_VITALS,
};

export function getIssueTitleFromType(issueType: string): IssueTitle | undefined {
  if (issueType in ISSUE_TYPE_TO_ISSUE_TITLE) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return ISSUE_TYPE_TO_ISSUE_TITLE[issueType];
  }
  return undefined;
}

const OCCURRENCE_TYPE_TO_ISSUE_TYPE = {
  1001: IssueType.PERFORMANCE_SLOW_DB_QUERY,
  1004: IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
  1006: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
  1906: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
  1007: IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
  1008: IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD,
  1009: IssueType.PERFORMANCE_CONSECUTIVE_HTTP,
  1010: IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
  1910: IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
  1012: IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
  1013: IssueType.PERFORMANCE_DB_MAIN_THREAD,
  1015: IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD,
  1016: IssueType.PERFORMANCE_HTTP_OVERHEAD,
  1018: IssueType.PERFORMANCE_ENDPOINT_REGRESSION,
  1021: IssueType.QUERY_INJECTION_VULNERABILITY,
  2001: IssueType.PROFILE_FILE_IO_MAIN_THREAD,
  2002: IssueType.PROFILE_IMAGE_DECODE_MAIN_THREAD,
  2003: IssueType.PROFILE_JSON_DECODE_MAIN_THREAD,
  2007: IssueType.PROFILE_REGEX_MAIN_THREAD,
  2008: IssueType.PROFILE_FRAME_DROP,
  2010: IssueType.PROFILE_FUNCTION_REGRESSION,
  10001: IssueType.WEB_VITALS,
};

const PERFORMANCE_REGRESSION_TYPE_IDS = new Set([1017, 1018, 2010, 2011]);

export function getIssueTypeFromOccurrenceType(
  typeId: number | undefined
): IssueType | null {
  if (!typeId) {
    return null;
  }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return OCCURRENCE_TYPE_TO_ISSUE_TYPE[typeId] ?? null;
}

export function isTransactionBased(typeId: number | undefined): boolean {
  if (!typeId) {
    return false;
  }
  // the 1xxx type ids are transaction based performance issues
  return typeId >= 1000 && typeId < 2000;
}

export function isOccurrenceBased(typeId: number | undefined): boolean {
  if (!typeId) {
    return false;
  }
  // these are regression type performance issues
  return !PERFORMANCE_REGRESSION_TYPE_IDS.has(typeId);
}

// endpoint: /api/0/issues/:issueId/attachments/?limit=50
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

/**
 * Issue Tags
 */
export type Tag = {
  key: string;
  name: string;
  alias?: string;

  isInput?: boolean;

  kind?: FieldKind;
  /**
   * How many values should be suggested in autocomplete.
   * Overrides SmartSearchBar's `maxSearchItems` prop.
   */
  maxSuggestedValues?: number;
  predefined?: boolean;
  secondaryAliases?: string[];
  totalValues?: number;
  uniqueValues?: number;
  /**
   * Usually values are strings, but a predefined tag can define its SearchGroups
   */
  values?: string[] | SearchGroup[];
};

export type TagCollection = Record<string, Tag>;

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
type Annotation = {
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
type SuggestedOwner = {
  date_added: string;
  owner: string;
  type: SuggestedOwnerReason;
};

export interface ParsedOwnershipRule {
  matcher: {pattern: string; type: string};
  owners: Actor[];
}

export type IssueOwnership = {
  autoAssignment:
    | 'Auto Assign to Suspect Commits'
    | 'Auto Assign to Issue Owner'
    | 'Turn off Auto-Assignment';
  codeownersAutoSync: boolean;
  dateCreated: string | null;
  fallthrough: boolean;
  isActive: boolean;
  lastUpdated: string | null;
  raw: string | null;
  schema?: {rules: ParsedOwnershipRule[]; version: number};
};

export enum GroupActivityType {
  NOTE = 'note',
  SET_RESOLVED = 'set_resolved',
  SET_RESOLVED_BY_AGE = 'set_resolved_by_age',
  SET_RESOLVED_IN_RELEASE = 'set_resolved_in_release',
  SET_RESOLVED_IN_COMMIT = 'set_resolved_in_commit',
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
}

interface GroupActivityBase {
  dateCreated: string;
  id: string;
  assignee?: string;
  issue?: Group;
  sentry_app?: AvatarSentryApp;
  user?: null | User;
}

export interface GroupActivityNote extends GroupActivityBase {
  data: {
    text: string;
  };
  type: GroupActivityType.NOTE;
}

interface GroupActivitySetResolved extends GroupActivityBase {
  data: Record<string, string>;
  type: GroupActivityType.SET_RESOLVED;
}

/**
 * An integration marks an issue as resolved
 */
interface GroupActivitySetResolvedIntegration extends GroupActivityBase {
  data: {
    integration_id: number;
    /**
     * Human readable name of the integration
     */
    provider: string;
    /**
     * The key of the integration
     */
    provider_key: string;
  };
  type: GroupActivityType.SET_RESOLVED;
}

interface GroupActivitySetUnresolved extends GroupActivityBase {
  data: Record<string, string>;
  type: GroupActivityType.SET_UNRESOLVED;
}

interface GroupActivitySetUnresolvedForecast extends GroupActivityBase {
  data: {
    forecast: number;
  };
  type: GroupActivityType.SET_UNRESOLVED;
}

/**
 * An integration marks an issue as unresolved
 */
interface GroupActivitySetUnresolvedIntegration extends GroupActivityBase {
  data: {
    integration_id: number;
    /**
     * Human readable name of the integration
     */
    provider: string;
    /**
     * The key of the integration
     */
    provider_key: string;
  };
  type: GroupActivityType.SET_UNRESOLVED;
}

interface GroupActivitySetPublic extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.SET_PUBLIC;
}

interface GroupActivitySetPrivate extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.SET_PRIVATE;
}

interface GroupActivitySetByAge extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.SET_RESOLVED_BY_AGE;
}

interface GroupActivityUnassigned extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.UNASSIGNED;
}

interface GroupActivityFirstSeen extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.FIRST_SEEN;
}

interface GroupActivityMarkReviewed extends GroupActivityBase {
  data: Record<string, any>;
  type: GroupActivityType.MARK_REVIEWED;
}

interface GroupActivityRegression extends GroupActivityBase {
  data: {
    /**
     * True if the project is using semver to decide if the event is a regression.
     * Available when the issue was resolved in a release.
     */
    follows_semver?: boolean;
    /**
     * The version that the issue was previously resolved in.
     * Available when the issue was resolved in a release.
     */
    resolved_in_version?: string;
    version?: string;
  };
  type: GroupActivityType.SET_REGRESSION;
}

interface GroupActivitySetByResolvedInNextSemverRelease extends GroupActivityBase {
  data: {
    // Set for semver releases
    current_release_version: string;
  };
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE;
}

interface GroupActivitySetByResolvedInRelease extends GroupActivityBase {
  data: {
    version?: string;
  };
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE;
}

interface GroupActivitySetByResolvedInCommit extends GroupActivityBase {
  data: {
    commit?: Commit;
  };
  type: GroupActivityType.SET_RESOLVED_IN_COMMIT;
}

interface GroupActivitySetByResolvedInPullRequest extends GroupActivityBase {
  data: {
    pullRequest?: PullRequest;
  };
  type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST;
}

export interface GroupActivitySetIgnored extends GroupActivityBase {
  data: {
    ignoreCount?: number;
    ignoreDuration?: number;
    ignoreUntil?: string;
    /** Archived until escalating */
    ignoreUntilEscalating?: boolean;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
  };
  type: GroupActivityType.SET_IGNORED;
}

export interface GroupActivityReprocess extends GroupActivityBase {
  data: {
    eventCount: number;
    newGroupId: number;
    oldGroupId: number;
  };
  type: GroupActivityType.REPROCESS;
}

interface GroupActivityUnmergeDestination extends GroupActivityBase {
  data: {
    fingerprints: string[];
    source?: {
      id: string;
      shortId: string;
    };
  };
  type: GroupActivityType.UNMERGE_DESTINATION;
}

interface GroupActivityUnmergeSource extends GroupActivityBase {
  data: {
    fingerprints: string[];
    destination?: {
      id: string;
      shortId: string;
    };
  };
  type: GroupActivityType.UNMERGE_SOURCE;
}

interface GroupActivityMerge extends GroupActivityBase {
  data: {
    issues: any[];
  };
  type: GroupActivityType.MERGE;
}

interface GroupActivityAutoSetOngoing extends GroupActivityBase {
  data: {
    afterDays?: number;
  };
  type: GroupActivityType.AUTO_SET_ONGOING;
}

export interface GroupActivitySetEscalating extends GroupActivityBase {
  data: {
    expired_snooze?: {
      count: number | null;
      until: Date | null;
      user_count: number | null;
      user_window: number | null;
      window: number | null;
    };
    forecast?: number;
  };
  type: GroupActivityType.SET_ESCALATING;
}

export interface GroupActivitySetPriority extends GroupActivityBase {
  data: {
    priority: PriorityLevel;
    reason: string;
  };
  type: GroupActivityType.SET_PRIORITY;
}

export interface GroupActivityAssigned extends GroupActivityBase {
  data: {
    assignee: string;
    assigneeType: string;
    user: Team | User;
    assigneeEmail?: string;
    /**
     * If the user was assigned via an integration
     */
    integration?:
      | 'projectOwnership'
      | 'codeowners'
      | 'slack'
      | 'msteams'
      | 'suspectCommitter';
    /** Codeowner or Project owner rule as a string */
    rule?: string;
  };
  type: GroupActivityType.ASSIGNED;
}

export interface GroupActivityCreateIssue extends GroupActivityBase {
  data: {
    location: string;
    provider: string;
    title: string;
    new?: boolean;
  };
  type: GroupActivityType.CREATE_ISSUE;
}

interface GroupActivityDeletedAttachment extends GroupActivityBase {
  data: Record<string, string>;
  type: GroupActivityType.DELETED_ATTACHMENT;
}

export type GroupActivity =
  | GroupActivityNote
  | GroupActivitySetResolved
  | GroupActivitySetResolvedIntegration
  | GroupActivitySetUnresolved
  | GroupActivitySetUnresolvedForecast
  | GroupActivitySetUnresolvedIntegration
  | GroupActivitySetIgnored
  | GroupActivitySetByAge
  | GroupActivitySetByResolvedInRelease
  | GroupActivitySetByResolvedInNextSemverRelease
  | GroupActivitySetByResolvedInCommit
  | GroupActivitySetByResolvedInPullRequest
  | GroupActivityFirstSeen
  | GroupActivityMerge
  | GroupActivityReprocess
  | GroupActivityUnassigned
  | GroupActivityMarkReviewed
  | GroupActivityUnmergeDestination
  | GroupActivitySetPublic
  | GroupActivitySetPrivate
  | GroupActivityRegression
  | GroupActivityUnmergeSource
  | GroupActivityAssigned
  | GroupActivityCreateIssue
  | GroupActivityAutoSetOngoing
  | GroupActivitySetEscalating
  | GroupActivitySetPriority
  | GroupActivityDeletedAttachment;

export type Activity = GroupActivity;

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
export interface ResolvedStatusDetails {
  actor?: AvatarUser;
  autoResolved?: boolean;
  inCommit?: {
    commit?: string;
    dateCreated?: string;
    id?: string;
    repository?: string | Repository;
  };
  inNextRelease?: boolean;
  inRelease?: string;
  repository?: string;
}
interface ReprocessingStatusDetails {
  info: {
    dateCreated: string;
    totalEvents: number;
  } | null;
  pendingEvents: number;
}

export interface UserParticipant extends User {
  type: 'user';
}

export interface TeamParticipant extends Team {
  type: 'team';
}

/**
 * The payload sent when marking reviewed
 */
export interface MarkReviewed {
  inbox: false;
}
/**
 * The payload sent when updating a group's status
 */

export interface GroupStatusResolution {
  status: GroupStatus.RESOLVED | GroupStatus.UNRESOLVED | GroupStatus.IGNORED;
  statusDetails: ResolvedStatusDetails | IgnoredStatusDetails | Record<string, unknown>;
  substatus?: GroupSubstatus | null;
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

// TODO(ts): incomplete
export interface BaseGroup {
  activity: GroupActivity[];
  annotations: Annotation[];
  assignedTo: Actor | null;
  culprit: string;
  firstSeen: string;
  hasSeen: boolean;
  id: string;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  issueCategory: IssueCategory;
  issueType: IssueType;
  lastSeen: string;
  level: Level;
  logger: string | null;
  metadata: EventMetadata;
  numComments: number;
  participants: Array<UserParticipant | TeamParticipant>;
  permalink: string;
  platform: PlatformKey;
  pluginActions: Array<[title: string, actionLink: string]>;
  pluginContexts: any[]; // TODO(ts)
  pluginIssues: TitledPlugin[];
  priority: PriorityLevel;
  priorityLockedAt: string | null;
  project: Project;
  seenBy: User[];
  shareId: string;
  shortId: string;
  status: GroupStatus;
  statusDetails: IgnoredStatusDetails | ResolvedStatusDetails | ReprocessingStatusDetails;
  subscriptionDetails: {disabled?: boolean; reason?: string} | null;
  title: string;
  type: EventOrGroupType;
  userReportCount: number;
  inbox?: InboxDetails | null | false;
  integrationIssues?: ExternalIssue[];
  latestEvent?: Event;
  latestEventHasAttachments?: boolean;
  owners?: SuggestedOwner[] | null;
  seerAutofixLastTriggered?: string | null;
  seerFixabilityScore?: number | null;
  sentryAppIssues?: PlatformExternalIssue[];
  substatus?: GroupSubstatus | null;
}

interface GroupOpenPeriodActivity {
  dateCreated: string;
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

export interface GroupReprocessing extends BaseGroup, GroupStats {
  status: GroupStatus.REPROCESSING;
  statusDetails: ReprocessingStatusDetails;
}

interface GroupResolved extends BaseGroup, GroupStats {
  status: GroupStatus.RESOLVED;
  statusDetails: ResolvedStatusDetails;
}

interface GroupIgnored extends BaseGroup, GroupStats {
  status: GroupStatus.IGNORED;
  statusDetails: IgnoredStatusDetails;
}

export interface GroupUnresolved extends BaseGroup, GroupStats {
  status: GroupStatus.UNRESOLVED;
  statusDetails: Record<string, unknown>;
}

export type Group = GroupUnresolved | GroupResolved | GroupIgnored | GroupReprocessing;

// Maps to SimpleGroupSerializer in the backend
export type SimpleGroup = {
  culprit: string | null;
  firstSeen: string;
  id: string;
  issueCategory: IssueCategory;
  issueType: IssueType;
  lastSeen: string;
  level: Level;
  metadata: EventMetadata;
  project: AvatarProject;
  shortId: string;
  status: GroupStatus;
  substatus: GroupSubstatus | null;
  title: string;
  type: EventOrGroupType;
};

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

/**
 * Old User Feedback
 */
export type UserReport = {
  comments: string;
  dateCreated: string;
  email: string;
  event: {eventID: string; id: string};
  eventID: string;
  id: string;
  issue: Group;
  name: string;
  user: User;
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

// Response from ShortIdLookupEndpoint
// /organizations/${orgId}/shortids/${query}/
export type ShortIdResponse = {
  group: Group;
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
  shortId: string;
};
