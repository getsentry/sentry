import type {PlatformKey} from 'sentry/data/platformCategories';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import type {Actor, TimeseriesValue} from './core';
import type {Event, EventMetadata, EventOrGroupType, Level} from './event';
import type {Commit, PullRequest} from './integrations';
import type {Team} from './organization';
import type {Project} from './project';
import type {Release} from './release';
import type {AvatarUser, User} from './user';

export type EntryData = Record<string, any | Array<any>>;

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
  isOrgCustom: boolean;
  isPinned: boolean;
  name: string;
  query: string;
  sort: string;
  type: SavedSearchType;
};

export enum SavedSearchType {
  ISSUE = 0,
  EVENT = 1,
  SESSION = 2,
}

// endpoint: /api/0/issues/:issueId/attachments/?limit=50
export type IssueAttachment = {
  dateCreated: string;
  event_id: string;
  headers: Object;
  id: string;
  mimetype: string;
  name: string;
  sha1: string;
  size: number;
  type: string;
};

// endpoint: /api/0/projects/:orgSlug/:projSlug/events/:eventId/attachments/
export type EventAttachment = Omit<IssueAttachment, 'event_id'>;

/**
 * Issue Tags
 */
export type Tag = {
  key: string;
  name: string;

  documentation?: string;
  isInput?: boolean;

  kind?: FieldValueKind;
  /**
   * How many values should be suggested in autocomplete.
   * Overrides SmartSearchBar's `maxSearchItems` prop.
   */
  maxSuggestedValues?: number;
  predefined?: boolean;
  totalValues?: number;
  values?: string[];
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
};

export type TagWithTopValues = {
  key: string;
  name: string;
  topValues: Array<Topvalue>;
  totalValues: number;
  uniqueValues: number;
  canDelete?: boolean;
};

/**
 * Inbox, issue owners and Activity
 */
export type InboxReasonDetails = {
  count?: number | null;
  until?: string | null;
  user_count?: number | null;
  user_window?: number | null;
  window?: number | null;
};

export type InboxDetails = {
  reason_details: InboxReasonDetails;
  date_added?: string;
  reason?: number;
};

export type SuggestedOwnerReason = 'suspectCommit' | 'ownershipRule';

// Received from the backend to denote suggested owners of an issue
export type SuggestedOwner = {
  date_added: string;
  owner: string;
  type: SuggestedOwnerReason;
};

export type IssueOwnership = {
  autoAssignment: boolean;
  dateCreated: string;
  fallthrough: boolean;
  isActive: boolean;
  lastUpdated: string;
  raw: string;
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
}

type GroupActivityBase = {
  dateCreated: string;
  id: string;
  project: Project;
  assignee?: string;
  issue?: Group;
  user?: null | User;
};

type GroupActivityNote = GroupActivityBase & {
  data: {
    text: string;
  };
  type: GroupActivityType.NOTE;
};

type GroupActivitySetResolved = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.SET_RESOLVED;
};

type GroupActivitySetUnresolved = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.SET_UNRESOLVED;
};

type GroupActivitySetPublic = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.SET_PUBLIC;
};

type GroupActivitySetPrivate = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.SET_PRIVATE;
};

type GroupActivitySetByAge = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.SET_RESOLVED_BY_AGE;
};

type GroupActivityUnassigned = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.UNASSIGNED;
};

type GroupActivityFirstSeen = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.FIRST_SEEN;
};

type GroupActivityMarkReviewed = GroupActivityBase & {
  data: Record<string, any>;
  type: GroupActivityType.MARK_REVIEWED;
};

type GroupActivityRegression = GroupActivityBase & {
  data: {
    version?: string;
  };
  type: GroupActivityType.SET_REGRESSION;
};

export type GroupActivitySetByResolvedInRelease = GroupActivityBase & {
  data: {
    current_release_version?: string;
    version?: string;
  };
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE;
};

type GroupActivitySetByResolvedInCommit = GroupActivityBase & {
  data: {
    commit: Commit;
  };
  type: GroupActivityType.SET_RESOLVED_IN_COMMIT;
};

type GroupActivitySetByResolvedInPullRequest = GroupActivityBase & {
  data: {
    pullRequest: PullRequest;
  };
  type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST;
};

export type GroupActivitySetIgnored = GroupActivityBase & {
  data: {
    ignoreCount?: number;
    ignoreDuration?: number;
    ignoreUntil?: string;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
  };
  type: GroupActivityType.SET_IGNORED;
};

export type GroupActivityReprocess = GroupActivityBase & {
  data: {
    eventCount: number;
    newGroupId: number;
    oldGroupId: number;
  };
  type: GroupActivityType.REPROCESS;
};

type GroupActivityUnmergeDestination = GroupActivityBase & {
  data: {
    fingerprints: Array<string>;
    source?: {
      id: string;
      shortId: string;
    };
  };
  type: GroupActivityType.UNMERGE_DESTINATION;
};

type GroupActivityUnmergeSource = GroupActivityBase & {
  data: {
    fingerprints: Array<string>;
    destination?: {
      id: string;
      shortId: string;
    };
  };
  type: GroupActivityType.UNMERGE_SOURCE;
};

type GroupActivityMerge = GroupActivityBase & {
  data: {
    issues: Array<any>;
  };
  type: GroupActivityType.MERGE;
};

export type GroupActivityAssigned = GroupActivityBase & {
  data: {
    assignee: string;
    assigneeType: string;
    user: Team | User;
    assigneeEmail?: string;
  };
  type: GroupActivityType.ASSIGNED;
};

export type GroupActivityCreateIssue = GroupActivityBase & {
  data: {
    location: string;
    provider: string;
    title: string;
  };
  type: GroupActivityType.CREATE_ISSUE;
};

export type GroupActivity =
  | GroupActivityNote
  | GroupActivitySetResolved
  | GroupActivitySetUnresolved
  | GroupActivitySetIgnored
  | GroupActivitySetByAge
  | GroupActivitySetByResolvedInRelease
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
  | GroupActivityCreateIssue;

export type Activity = GroupActivity;

type GroupFiltered = {
  count: string;
  firstSeen: string;
  lastSeen: string;
  stats: Record<string, TimeseriesValue[]>;
  userCount: number;
};

export type GroupStats = GroupFiltered & {
  filtered: GroupFiltered | null;
  id: string;
  lifetime?: GroupFiltered;
  sessionCount?: string | null;
};

export type BaseGroupStatusReprocessing = {
  status: 'reprocessing';
  statusDetails: {
    info: {
      dateCreated: string;
      totalEvents: number;
    } | null;
    pendingEvents: number;
  };
};

/**
 * Issue Resolution
 */
export enum ResolutionStatus {
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
  IGNORED = 'ignored',
}
export type ResolutionStatusDetails = {
  actor?: AvatarUser;
  autoResolved?: boolean;
  ignoreCount?: number;
  // Sent in requests. ignoreUntil is used in responses.
  ignoreDuration?: number;
  ignoreUntil?: string;
  ignoreUserCount?: number;
  ignoreUserWindow?: number;
  ignoreWindow?: number;
  inCommit?: Commit;
  inNextRelease?: boolean;
  inRelease?: string;
};

export type UpdateResolutionStatus = {
  status: ResolutionStatus;
  statusDetails?: ResolutionStatusDetails;
};

type BaseGroupStatusResolution = {
  status: ResolutionStatus;
  statusDetails: ResolutionStatusDetails;
};

export type GroupRelease = {
  firstRelease: Release;
  lastRelease: Release;
};

// TODO(ts): incomplete
export type BaseGroup = {
  activity: GroupActivity[];
  annotations: string[];
  assignedTo: Actor;
  culprit: string;
  firstSeen: string;
  hasSeen: boolean;
  id: string;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  isUnhandled: boolean;
  lastSeen: string;
  latestEvent: Event;
  level: Level;
  logger: string;
  metadata: EventMetadata;
  numComments: number;
  participants: User[];
  permalink: string;
  platform: PlatformKey;
  pluginActions: any[]; // TODO(ts)
  pluginContexts: any[]; // TODO(ts)
  pluginIssues: any[]; // TODO(ts)
  project: Project;
  seenBy: User[];
  shareId: string;
  shortId: string;
  status: string;
  subscriptionDetails: {disabled?: boolean; reason?: string} | null;
  tags: Pick<Tag, 'key' | 'name' | 'totalValues'>[];
  title: string;
  type: EventOrGroupType;
  userReportCount: number;
  inbox?: InboxDetails | null | false;
  owners?: SuggestedOwner[] | null;
} & GroupRelease;

export type GroupReprocessing = BaseGroup & GroupStats & BaseGroupStatusReprocessing;
export type GroupResolution = BaseGroup & GroupStats & BaseGroupStatusResolution;
export type Group = GroupResolution | GroupReprocessing;
export type GroupCollapseRelease = Omit<Group, keyof GroupRelease> &
  Partial<GroupRelease>;

export type GroupTombstone = {
  actor: AvatarUser;
  culprit: string;
  id: string;
  level: Level;
  metadata: EventMetadata;
  title: string;
};

export type ProcessingIssueItem = {
  checksum: string;
  data: {
    // TODO(ts) This type is likely incomplete, but this is what
    // project processing issues settings uses.
    _scope: string;
    image_arch: string;
    image_path: string;
    image_uuid: string;
  };
  id: string;
  lastSeen: string;
  numEvents: number;
  type: string;
};

export type ProcessingIssue = {
  hasIssues: boolean;
  hasMoreResolveableIssues: boolean;
  issuesProcessing: number;
  lastSeen: string;
  numIssues: number;
  project: string;
  resolveableIssues: number;
  signedLink: string;
  issues?: ProcessingIssueItem[];
};

/**
 * Datascrubbing
 */
export type Meta = {
  chunks: Array<ChunkType>;
  err: Array<MetaError>;
  len: number;
  rem: Array<MetaRemark>;
};

export type MetaError = string | [string, any];
export type MetaRemark = Array<string | number>;

export type ChunkType = {
  rule_id: string | number;
  text: string;
  type: string;
  remark?: string | number;
};

/**
 * User Feedback
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

export type KeyValueListData = {
  key: string;
  subject: string;
  actionButton?: React.ReactNode;
  meta?: Meta;
  subjectDataTestId?: string;
  subjectIcon?: React.ReactNode;
  value?: React.ReactNode;
}[];

// Response from ShortIdLookupEndpoint
// /organizations/${orgId}/shortids/${query}/
export type ShortIdResponse = {
  group: Group;
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
  shortId: string;
};

/**
 * Note used in Group Activity and Alerts for users to comment
 */
export type Note = {
  /**
   * Array of [id, display string] tuples used for @-mentions
   */
  mentions: [string, string][];

  /**
   * Note contents (markdown allowed)
   */
  text: string;
};
