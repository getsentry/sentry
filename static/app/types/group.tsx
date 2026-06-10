import type {SearchGroup} from 'sentry/components/searchBar/types';
import {t} from 'sentry/locale';
import {
  GroupActivityType,
  GroupStatus,
  GroupSubstatus,
  IssueCategory,
  IssueTitle,
  IssueType,
  PriorityLevel,
} from 'sentry/types/groupBase';
import type {
  Annotation,
  GroupStats,
  IgnoredStatusDetails,
  InboxDetails,
  ReprocessingStatusDetails,
  SuggestedOwner,
} from 'sentry/types/groupBase';
import type {ParsedOwnershipRule} from 'sentry/types/ownership';
import type {TitledPlugin} from 'sentry/types/plugins';
import type {FieldKind} from 'sentry/utils/fields';

import type {Actor} from './coreBase';
import type {Event} from './event';
import type {EventMetadata, EventOrGroupType, Level} from './eventBase';
import type {
  AvatarSentryApp,
  Commit,
  ExternalIssue,
  PlatformExternalIssue,
  PullRequest,
  Repository,
} from './integrations';
import type {Team} from './organization';
import type {PlatformKey} from './platform';
import type {AvatarProject, Project} from './project';
import type {User} from './user';
import type {AvatarUser} from './userBase';

/**
 * These are issue categories that are generally filterable in the UI.
 * Do not include deprecated or test categories.
 */

export const VALID_ISSUE_CATEGORIES = [
  IssueCategory.ERROR,
  IssueCategory.OUTAGE,
  IssueCategory.METRIC,
  IssueCategory.DB_QUERY,
  IssueCategory.HTTP_CLIENT,
  IssueCategory.FRONTEND,
  IssueCategory.MOBILE,
  IssueCategory.FEEDBACK,
  IssueCategory.PREPROD,
  IssueCategory.CONFIGURATION,
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
  [IssueCategory.AI_DETECTED]: t('AI detected issues.'),
  [IssueCategory.PREPROD]: t('Problems detected via static analysis.'),
  [IssueCategory.CONFIGURATION]: t(
    'Issues detected from SDK/tooling configuration problems.'
  ),
};

// Issue types that should not be visible to users anywhere in the UI
// Update this if adding an issue type that you don't want to show up in search!
const HIDDEN_ISSUE_TYPES: IssueType[] = [
  IssueType.LLM_DETECTED_EXPERIMENTAL,
  IssueType.LLM_DETECTED_EXPERIMENTAL_V2,
  IssueType.AI_DETECTED_HTTP,
  IssueType.AI_DETECTED_DB,
  IssueType.AI_DETECTED_RUNTIME_PERFORMANCE,
  IssueType.AI_DETECTED_SECURITY,
  IssueType.AI_DETECTED_CODE_HEALTH,
  IssueType.AI_DETECTED_GENERAL,
];

export const AI_DETECTED_ISSUE_TYPES = new Set<IssueType>([
  IssueType.AI_DETECTED_HTTP,
  IssueType.AI_DETECTED_DB,
  IssueType.AI_DETECTED_RUNTIME_PERFORMANCE,
  IssueType.AI_DETECTED_SECURITY,
  IssueType.AI_DETECTED_CODE_HEALTH,
]);

export const VISIBLE_ISSUE_TYPES = Object.values(IssueType).filter(
  type => !HIDDEN_ISSUE_TYPES.includes(type)
);

const ISSUE_TYPE_TO_ISSUE_TITLE = {
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

  llm_detected_experimental: IssueTitle.LLM_DETECTED_EXPERIMENTAL,
  llm_detected_experimental_v2: IssueTitle.LLM_DETECTED_EXPERIMENTAL_V2,
  ai_detected_http: IssueTitle.AI_DETECTED_HTTP,
  ai_detected_db: IssueTitle.AI_DETECTED_DB,
  ai_detected_runtime_performance: IssueTitle.AI_DETECTED_RUNTIME_PERFORMANCE,
  ai_detected_security: IssueTitle.AI_DETECTED_SECURITY,
  ai_detected_code_health: IssueTitle.AI_DETECTED_CODE_HEALTH,
  ai_detected_general: IssueTitle.AI_DETECTED_GENERAL,

  preprod_static: IssueTitle.PREPROD_STATIC,
  preprod_delta: IssueTitle.PREPROD_DELTA,
  preprod_size_analysis: IssueTitle.PREPROD_SIZE_ANALYSIS,

  sourcemap_configuration: IssueTitle.SOURCEMAP_CONFIGURATION,
  low_value_span_configuration: IssueTitle.LOW_VALUE_SPAN_CONFIGURATION,
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
  3501: IssueType.LLM_DETECTED_EXPERIMENTAL,
  3502: IssueType.LLM_DETECTED_EXPERIMENTAL_V2,
  3503: IssueType.AI_DETECTED_HTTP,
  3504: IssueType.AI_DETECTED_DB,
  3505: IssueType.AI_DETECTED_RUNTIME_PERFORMANCE,
  3506: IssueType.AI_DETECTED_SECURITY,
  3507: IssueType.AI_DETECTED_CODE_HEALTH,
  3508: IssueType.AI_DETECTED_GENERAL,
  10001: IssueType.WEB_VITALS,
  11001: IssueType.PREPROD_STATIC,
  11002: IssueType.PREPROD_DELTA,
  11003: IssueType.PREPROD_SIZE_ANALYSIS,
};

// Occurrence type IDs for hidden issue types - used to filter API queries.
// Note: This only works for issuePlatform events not discover/error events.
export const HIDDEN_OCCURRENCE_TYPE_IDS: number[] = Object.entries(
  OCCURRENCE_TYPE_TO_ISSUE_TYPE
)
  .filter(([_, issueType]) => HIDDEN_ISSUE_TYPES.includes(issueType))
  .map(([id]) => Number(id));

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

export const SEER_ACTIVITY_TYPES = new Set<GroupActivityType>([
  GroupActivityType.SEER_RCA_STARTED,
  GroupActivityType.SEER_RCA_COMPLETED,
  GroupActivityType.SEER_SOLUTION_STARTED,
  GroupActivityType.SEER_SOLUTION_COMPLETED,
  GroupActivityType.SEER_CODING_STARTED,
  GroupActivityType.SEER_CODING_COMPLETED,
  GroupActivityType.SEER_PR_CREATED,
]);

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
    inNextRelease?: boolean;
    integration_id?: number;
    provider?: string;
    provider_key?: string;
  };
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE;
}

interface GroupActivitySetByResolvedInRelease extends GroupActivityBase {
  data: {
    inNextRelease?: boolean;
    integration_id?: number;
    provider?: string;
    provider_key?: string;
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

interface GroupActivityReferencedInCommit extends GroupActivityBase {
  data: {
    commit?: Commit;
  };
  type: GroupActivityType.REFERENCED_IN_COMMIT;
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

interface GroupActivitySeerRcaStarted extends GroupActivityBase {
  data: {
    run_id?: number;
  };
  type: GroupActivityType.SEER_RCA_STARTED;
}

interface GroupActivitySeerRcaCompleted extends GroupActivityBase {
  data: {
    run_id?: number;
    summary?: string;
  };
  type: GroupActivityType.SEER_RCA_COMPLETED;
}

interface GroupActivitySeerSolutionStarted extends GroupActivityBase {
  data: {
    run_id?: number;
  };
  type: GroupActivityType.SEER_SOLUTION_STARTED;
}

interface GroupActivitySeerSolutionCompleted extends GroupActivityBase {
  data: {
    run_id?: number;
    summary?: string;
  };
  type: GroupActivityType.SEER_SOLUTION_COMPLETED;
}

interface GroupActivitySeerCodingStarted extends GroupActivityBase {
  data: {
    run_id?: number;
  };
  type: GroupActivityType.SEER_CODING_STARTED;
}

interface GroupActivitySeerCodingCompleted extends GroupActivityBase {
  data: {
    run_id?: number;
  };
  type: GroupActivityType.SEER_CODING_COMPLETED;
}

interface GroupActivitySeerPrCreated extends GroupActivityBase {
  data: {
    pull_requests?: Array<{
      provider: string;
      pull_request: {
        pr_number: number;
        pr_url: string;
      };
      repo_name: string;
    }>;
    run_id?: number;
  };
  type: GroupActivityType.SEER_PR_CREATED;
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
  | GroupActivityReferencedInCommit
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
  | GroupActivityDeletedAttachment
  | GroupActivitySeerRcaStarted
  | GroupActivitySeerRcaCompleted
  | GroupActivitySeerSolutionStarted
  | GroupActivitySeerSolutionCompleted
  | GroupActivitySeerCodingStarted
  | GroupActivitySeerCodingCompleted
  | GroupActivitySeerPrCreated;

export type Activity = GroupActivity;

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

export interface UserParticipant extends User {
  type: 'user';
}

export interface TeamParticipant extends Team {
  type: 'team';
}

/**
 * The payload sent when updating a group's status
 */

export interface GroupStatusResolution {
  status: GroupStatus.RESOLVED | GroupStatus.UNRESOLVED | GroupStatus.IGNORED;
  statusDetails: ResolvedStatusDetails | IgnoredStatusDetails | Record<string, unknown>;
  substatus?: GroupSubstatus | null;
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
  seerExplorerAutofixLastTriggered?: string | null;
  seerFixabilityScore?: number | null;
  sentryAppIssues?: PlatformExternalIssue[];
  substatus?: GroupSubstatus | null;
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

/**
 * Old User Feedback
 */
export type UserReport = {
  comments: string;
  dateCreated: string;
  email: string | null;
  event: {eventID: string; id: string};
  eventID: string;
  id: string;
  name: string | null;
  user: {
    avatarUrl: string | null;
    email: string | null;
    id: string;
    ipAddress: string | null;
    name: string | null;
    username: string | null;
  } | null;
  issue?: Group | null;
};

// Response from ShortIdLookupEndpoint
// /organizations/${orgId}/shortids/${query}/
export type ShortIdResponse = {
  group: Group;
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
  shortId: string;
};
