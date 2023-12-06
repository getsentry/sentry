import {Project} from 'sentry/types/project';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import type {Actor, Avatar, ObjectStatus, Scope} from './core';
import type {OrgExperiments} from './experiments';
import type {ExternalTeam} from './integrations';
import type {OnboardingTaskStatus} from './onboarding';
import type {Relay} from './relay';
import type {User} from './user';

/**
 * Organization summaries are sent when you request a list of all organizations
 */
export interface OrganizationSummary {
  aiSuggestedSolution: boolean;
  avatar: Avatar;
  codecovAccess: boolean;
  dateCreated: string;
  features: string[];
  githubNudgeInvite: boolean;
  githubOpenPRBot: boolean;
  githubPRBot: boolean;
  id: string;
  isEarlyAdopter: boolean;
  links: {
    organizationUrl: string;
    regionUrl: string;
  };
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    id: ObjectStatus;
    name: string;
  };
}

/**
 * Detailed organization (e.g. when requesting details for a single org)
 */
export interface Organization extends OrganizationSummary {
  access: Scope[];
  alertsMemberWrite: boolean;
  allowJoinRequests: boolean;
  allowSharedIssues: boolean;
  attachmentsRole: string;
  availableRoles: {id: string; name: string}[]; // Deprecated, use orgRoleList
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  debugFilesRole: string;
  defaultRole: string;
  enhancedPrivacy: boolean;
  eventsMemberAdmin: boolean;
  experiments: Partial<OrgExperiments>;
  isDefault: boolean;
  isDynamicallySampled: boolean;
  onboardingTasks: OnboardingTaskStatus[];
  openMembership: boolean;
  orgRoleList: OrgRole[];
  pendingAccessRequests: number;
  quota: {
    accountLimit: number | null;
    maxRate: number | null;
    maxRateInterval: number | null;
    projectLimit: number | null;
  };
  relayPiiConfig: string | null;
  safeFields: string[];
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  storeCrashReports: number;
  teamRoleList: TeamRole[];
  trustedRelays: Relay[];
  desiredSampleRate?: number | null;
  effectiveSampleRate?: number | null;
  orgRole?: string;
}

export interface DetailedOrganization extends Organization {
  projects: Project[];
  teams: Team[];
}

export interface Team {
  access: Scope[];
  avatar: Avatar;
  externalTeams: ExternalTeam[];
  flags: {
    'idp:provisioned': boolean;
  };
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
  teamRole: string | null;
  orgRole?: string | null;
}

export interface DetailedTeam extends Team {
  projects: Project[];
}

// TODO: Rename to BaseRole
export interface MemberRole {
  desc: string;
  id: string;
  name: string;
  allowed?: boolean; // Deprecated: use isAllowed
  isAllowed?: boolean;
  isRetired?: boolean;
}
export interface OrgRole extends MemberRole {
  minimumTeamRole: string;
  isGlobal?: boolean;
  is_global?: boolean; // Deprecated: use isGlobal
}
export interface TeamRole extends MemberRole {
  isMinimumRoleFor: string;
}

/**
 * Returned from /organizations/org/users/
 */
export interface Member {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'idp:provisioned': boolean;
    'idp:role-restricted': boolean;
    'member-limit:restricted': boolean;
    'partnership:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
  };
  id: string;
  inviteStatus: 'approved' | 'requested_to_be_invited' | 'requested_to_join';
  invite_link: string | null;
  inviterName: string | null;
  isOnlyOwner: boolean;
  name: string;
  orgRole: OrgRole['id'];
  orgRoleList: OrgRole[];
  pending: boolean | undefined;
  projects: string[];
  /**
   * @deprecated use orgRole
   */
  role: OrgRole['id'];
  roleName: string;
  /**
   * @deprecated use orgRoleList
   */
  roles: OrgRole[];
  teamRoleList: TeamRole[];

  // TODO: Move to global store
  teamRoles: {
    role: string | null;
    teamSlug: string;
  }[];
  /**
   * @deprecated use teamRoles
   */
  teams: string[];
  // # Deprecated, use teamRoles
  /**
   * User may be null when the member represents an invited member
   */
  user: User | null;
  // TODO: Move to global store
  groupOrgRoles?: {role: OrgRole; teamSlug: string}[];
}

/**
 * Returned from TeamMembersEndpoint
 */
export interface TeamMember extends Member {
  teamRole?: string | null;
  teamSlug?: string;
}

/**
 * Users that exist in CommitAuthors but are not members of the organization.
 * These users commit to repos installed for the organization.
 */
export interface MissingMember {
  commitCount: number;
  email: string;
  // The user's ID in the repository provider (e.g. Github username)
  externalId: string;
}

/**
 * Minimal organization shape used on shared issue views.
 */
export type SharedViewOrganization = {
  slug: string;
  features?: Array<string>;
  id?: string;
};

export type AuditLog = {
  actor: User;
  data: any;
  dateCreated: string;
  event: string;
  id: string;
  ipAddress: string;
  note: string;
  targetObject: number;
  targetUser: Actor | null;
};

export type AccessRequest = {
  id: string;
  member: Member;
  team: Team;
  requester?: Partial<{
    email: string;
    name: string;
    username: string;
  }>;
};

/**
 * Discover queries and result sets.
 */
export type SavedQueryVersions = 1 | 2;

export interface NewQuery {
  fields: Readonly<string[]>;
  name: string;
  version: SavedQueryVersions;
  createdBy?: User;
  dataset?: DiscoverDatasets;
  display?: string;
  end?: string | Date;
  environment?: Readonly<string[]>;
  expired?: boolean;
  id?: string;
  interval?: string;
  orderby?: string;
  projects?: Readonly<number[]>;
  query?: string;
  range?: string;
  start?: string | Date;
  teams?: Readonly<('myteams' | number)[]>;
  topEvents?: string;
  utc?: boolean | string;
  widths?: Readonly<string[]>;
  yAxis?: string[];
}

export interface SavedQuery extends NewQuery {
  dateCreated: string;
  dateUpdated: string;
  id: string;
}

export type SavedQueryState = {
  hasError: boolean;
  isLoading: boolean;
  savedQueries: SavedQuery[];
};

export type EventsStatsData = [number, {count: number; comparisonCount?: number}[]][];

// API response format for a single series
export type EventsStats = {
  data: EventsStatsData;
  end?: number;
  isExtrapolatedData?: boolean;
  isMetricsData?: boolean;
  isMetricsExtractedData?: boolean;
  meta?: {
    fields: Record<string, AggregationOutputType>;
    isMetricsData: boolean;
    tips: {columns?: string; query?: string};
    units: Record<string, string>;
    isMetricsExtractedData?: boolean;
  };
  order?: number;
  start?: number;
  totals?: {count: number};
};

// API response format for multiple series
export type MultiSeriesEventsStats = {
  [seriesName: string]: EventsStats;
};

export type EventsStatsSeries<F extends string> = {
  data: {
    axis: F;
    values: number[];
    label?: string;
  }[];
  meta: {
    dataset: string;
    end: number;
    start: number;
  };
  timestamps: number[];
};

/**
 * Session API types.
 */
// Base type for series style API response
export interface SeriesApi {
  groups: {
    by: Record<string, string | number>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }[];
  intervals: string[];
}

export interface SessionApiResponse extends SeriesApi {
  end: string;
  query: string;
  start: string;
}

export enum SessionFieldWithOperation {
  SESSIONS = 'sum(session)',
  USERS = 'count_unique(user)',
  DURATION = 'p50(session.duration)',
  CRASH_FREE_RATE_USERS = 'crash_free_rate(user)',
  CRASH_FREE_RATE_SESSIONS = 'crash_free_rate(session)',
}

export enum SessionStatus {
  HEALTHY = 'healthy',
  ABNORMAL = 'abnormal',
  ERRORED = 'errored',
  CRASHED = 'crashed',
}
