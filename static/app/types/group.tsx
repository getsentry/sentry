import {PlatformKey} from 'sentry/data/platformCategories';

import {Actor, TimeseriesValue} from './core';
import {Event, EventMetadata, EventOrGroupType, Level} from './event';
import {Commit, PullRequest} from './integrations';
import {Team} from './organization';
import {Project} from './project';
import {Release} from './release';
import {AvatarUser, User} from './user';

export type EntryData = Record<string, any | Array<any>>;

/**
 * Saved issues searches
 */
export type RecentSearch = {
  id: string;
  organizationId: string;
  type: SavedSearchType;
  query: string;
  lastSeen: string;
  dateCreated: string;
};

// XXX: Deprecated Sentry 9 attributes are not included here.
export type SavedSearch = {
  id: string;
  type: SavedSearchType;
  name: string;
  query: string;
  sort: string;
  isGlobal: boolean;
  isPinned: boolean;
  isOrgCustom: boolean;
  dateCreated: string;
};

export enum SavedSearchType {
  ISSUE = 0,
  EVENT = 1,
}

// endpoint: /api/0/issues/:issueId/attachments/?limit=50
export type IssueAttachment = {
  id: string;
  dateCreated: string;
  headers: Object;
  mimetype: string;
  name: string;
  sha1: string;
  size: number;
  type: string;
  event_id: string;
};

// endpoint: /api/0/projects/:orgSlug/:projSlug/events/:eventId/attachments/
export type EventAttachment = Omit<IssueAttachment, 'event_id'>;

/**
 * Issue Tags
 */
export type Tag = {
  name: string;
  key: string;
  values?: string[];
  totalValues?: number;
  predefined?: boolean;
  isInput?: boolean;
  /**
   * How many values should be suggested in autocomplete.
   * Overrides SmartSearchBar's `maxSearchItems` prop.
   */
  maxSuggestedValues?: number;
};

export type TagCollection = Record<string, Tag>;

export type TagValue = {
  count: number;
  name: string;
  value: string;
  lastSeen: string;
  key: string;
  firstSeen: string;
  query?: string;
  email?: string;
  username?: string;
  identifier?: string;
  ipAddress?: string;
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
  topValues: Array<Topvalue>;
  key: string;
  name: string;
  totalValues: number;
  uniqueValues: number;
  canDelete?: boolean;
};

/**
 * Inbox, issue owners and Activity
 */
export type InboxReasonDetails = {
  until?: string | null;
  count?: number | null;
  window?: number | null;
  user_count?: number | null;
  user_window?: number | null;
};

export type InboxDetails = {
  reason_details: InboxReasonDetails;
  date_added?: string;
  reason?: number;
};

export type SuggestedOwnerReason = 'suspectCommit' | 'ownershipRule';

// Received from the backend to denote suggested owners of an issue
export type SuggestedOwner = {
  type: SuggestedOwnerReason;
  owner: string;
  date_added: string;
};

export type IssueOwnership = {
  raw: string;
  fallthrough: boolean;
  dateCreated: string;
  lastUpdated: string;
  isActive: boolean;
  autoAssignment: boolean;
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
  user?: null | User;
  assignee?: string;
  issue?: Group;
};

type GroupActivityNote = GroupActivityBase & {
  type: GroupActivityType.NOTE;
  data: {
    text: string;
  };
};

type GroupActivitySetResolved = GroupActivityBase & {
  type: GroupActivityType.SET_RESOLVED;
  data: Record<string, any>;
};

type GroupActivitySetUnresolved = GroupActivityBase & {
  type: GroupActivityType.SET_UNRESOLVED;
  data: Record<string, any>;
};

type GroupActivitySetPublic = GroupActivityBase & {
  type: GroupActivityType.SET_PUBLIC;
  data: Record<string, any>;
};

type GroupActivitySetPrivate = GroupActivityBase & {
  type: GroupActivityType.SET_PRIVATE;
  data: Record<string, any>;
};

type GroupActivitySetByAge = GroupActivityBase & {
  type: GroupActivityType.SET_RESOLVED_BY_AGE;
  data: Record<string, any>;
};

type GroupActivityUnassigned = GroupActivityBase & {
  type: GroupActivityType.UNASSIGNED;
  data: Record<string, any>;
};

type GroupActivityFirstSeen = GroupActivityBase & {
  type: GroupActivityType.FIRST_SEEN;
  data: Record<string, any>;
};

type GroupActivityMarkReviewed = GroupActivityBase & {
  type: GroupActivityType.MARK_REVIEWED;
  data: Record<string, any>;
};

type GroupActivityRegression = GroupActivityBase & {
  type: GroupActivityType.SET_REGRESSION;
  data: {
    version?: string;
  };
};

export type GroupActivitySetByResolvedInRelease = GroupActivityBase & {
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE;
  data: {
    version?: string;
    current_release_version?: string;
  };
};

type GroupActivitySetByResolvedInCommit = GroupActivityBase & {
  type: GroupActivityType.SET_RESOLVED_IN_COMMIT;
  data: {
    commit: Commit;
  };
};

type GroupActivitySetByResolvedInPullRequest = GroupActivityBase & {
  type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST;
  data: {
    pullRequest: PullRequest;
  };
};

export type GroupActivitySetIgnored = GroupActivityBase & {
  type: GroupActivityType.SET_IGNORED;
  data: {
    ignoreDuration?: number;
    ignoreUntil?: string;
    ignoreUserCount?: number;
    ignoreUserWindow?: number;
    ignoreWindow?: number;
    ignoreCount?: number;
  };
};

export type GroupActivityReprocess = GroupActivityBase & {
  type: GroupActivityType.REPROCESS;
  data: {
    eventCount: number;
    newGroupId: number;
    oldGroupId: number;
  };
};

type GroupActivityUnmergeDestination = GroupActivityBase & {
  type: GroupActivityType.UNMERGE_DESTINATION;
  data: {
    fingerprints: Array<string>;
    source?: {
      id: string;
      shortId: string;
    };
  };
};

type GroupActivityUnmergeSource = GroupActivityBase & {
  type: GroupActivityType.UNMERGE_SOURCE;
  data: {
    fingerprints: Array<string>;
    destination?: {
      id: string;
      shortId: string;
    };
  };
};

type GroupActivityMerge = GroupActivityBase & {
  type: GroupActivityType.MERGE;
  data: {
    issues: Array<any>;
  };
};

export type GroupActivityAssigned = GroupActivityBase & {
  type: GroupActivityType.ASSIGNED;
  data: {
    assignee: string;
    assigneeType: string;
    user: Team | User;
  };
};

export type GroupActivityCreateIssue = GroupActivityBase & {
  type: GroupActivityType.CREATE_ISSUE;
  data: {
    provider: string;
    location: string;
    title: string;
  };
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
  stats: Record<string, TimeseriesValue[]>;
  lastSeen: string;
  firstSeen: string;
  userCount: number;
};

export type GroupStats = GroupFiltered & {
  lifetime?: GroupFiltered;
  filtered: GroupFiltered | null;
  sessionCount?: string | null;
  id: string;
};

export type BaseGroupStatusReprocessing = {
  status: 'reprocessing';
  statusDetails: {
    pendingEvents: number;
    info: {
      dateCreated: string;
      totalEvents: number;
    } | null;
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
  inRelease?: string;
  inNextRelease?: boolean;
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
  id: string;
  latestEvent: Event;
  activity: GroupActivity[];
  annotations: string[];
  assignedTo: Actor;
  culprit: string;
  firstSeen: string;
  hasSeen: boolean;
  isBookmarked: boolean;
  isUnhandled: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  lastSeen: string;
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
  tags: Pick<Tag, 'key' | 'name' | 'totalValues'>[];
  title: string;
  type: EventOrGroupType;
  userReportCount: number;
  subscriptionDetails: {disabled?: boolean; reason?: string} | null;
  status: string;
  inbox?: InboxDetails | null | false;
  owners?: SuggestedOwner[] | null;
} & GroupRelease;

export type GroupReprocessing = BaseGroup & GroupStats & BaseGroupStatusReprocessing;
export type GroupResolution = BaseGroup & GroupStats & BaseGroupStatusResolution;
export type Group = GroupResolution | GroupReprocessing;
export type GroupCollapseRelease = Omit<Group, keyof GroupRelease> &
  Partial<GroupRelease>;

export type GroupTombstone = {
  id: string;
  title: string;
  culprit: string;
  level: Level;
  actor: AvatarUser;
  metadata: EventMetadata;
};

export type ProcessingIssueItem = {
  id: string;
  type: string;
  checksum: string;
  numEvents: number;
  data: {
    // TODO(ts) This type is likely incomplete, but this is what
    // project processing issues settings uses.
    _scope: string;
    image_arch: string;
    image_uuid: string;
    image_path: string;
  };
  lastSeen: string;
};

export type ProcessingIssue = {
  project: string;
  numIssues: number;
  signedLink: string;
  lastSeen: string;
  hasMoreResolveableIssues: boolean;
  hasIssues: boolean;
  issuesProcessing: number;
  resolveableIssues: number;
  issues?: ProcessingIssueItem[];
};

/**
 * Datascrubbing
 */
export type Meta = {
  chunks: Array<ChunkType>;
  len: number;
  rem: Array<MetaRemark>;
  err: Array<MetaError>;
};

export type MetaError = string | [string, any];
export type MetaRemark = Array<string | number>;

export type ChunkType = {
  text: string;
  type: string;
  rule_id: string | number;
  remark?: string | number;
};

/**
 * User Feedback
 */
export type UserReport = {
  id: string;
  eventID: string;
  issue: Group;
  name: string;
  event: {eventID: string; id: string};
  user: User;
  dateCreated: string;
  comments: string;
  email: string;
};

export type KeyValueListData = {
  key: string;
  subject: string;
  value?: React.ReactNode;
  meta?: Meta;
  subjectDataTestId?: string;
  subjectIcon?: React.ReactNode;
}[];

// Response from ShortIdLookupEndpoint
// /organizations/${orgId}/shortids/${query}/
export type ShortIdResponse = {
  organizationSlug: string;
  projectSlug: string;
  groupId: string;
  group: Group;
  shortId: string;
};

/**
 * Note used in Group Activity and Alerts for users to comment
 */
export type Note = {
  /**
   * Note contents (markdown allowed)
   */
  text: string;

  /**
   * Array of [id, display string] tuples used for @-mentions
   */
  mentions: [string, string][];
};
