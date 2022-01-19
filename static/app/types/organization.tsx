import {Actor, Avatar, Scope} from './core';
import {OrgExperiments} from './experiments';
import {ExternalTeam} from './integrations';
import {OnboardingTaskStatus} from './onboarding';
import {Relay} from './relay';
import {User} from './user';

/**
 * Organization summaries are sent when you request a
 * list of all organizations
 */
export type OrganizationSummary = {
  status: {
    // TODO(ts): Are these fields == `ObjectStatus`?
    id: string;
    name: string;
  };
  require2FA: boolean;
  avatar: Avatar;
  features: string[];
  name: string;
  dateCreated: string;
  id: string;
  isEarlyAdopter: boolean;
  slug: string;
};

/**
 * Detailed organization (e.g. when requesting details for a single org)
 */
export type Organization = OrganizationSummary & {
  relayPiiConfig: string;
  scrubIPAddresses: boolean;
  attachmentsRole: string;
  debugFilesRole: string;
  eventsMemberAdmin: boolean;
  alertsMemberWrite: boolean;
  sensitiveFields: string[];
  openMembership: boolean;
  quota: {
    maxRateInterval: number | null;
    projectLimit: number | null;
    accountLimit: number | null;
    maxRate: number | null;
  };
  defaultRole: string;
  experiments: Partial<OrgExperiments>;
  allowJoinRequests: boolean;
  scrapeJavaScript: boolean;
  isDefault: boolean;
  pendingAccessRequests: number;
  availableRoles: {id: string; name: string}[];
  enhancedPrivacy: boolean;
  safeFields: string[];
  storeCrashReports: number;
  access: Scope[];
  allowSharedIssues: boolean;
  dataScrubberDefaults: boolean;
  dataScrubber: boolean;
  apdexThreshold: number;
  onboardingTasks: OnboardingTaskStatus[];
  trustedRelays: Relay[];
  role?: string;
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  isMember: boolean;
  hasAccess: boolean;
  isPending: boolean;
  memberCount: number;
  avatar: Avatar;
  externalTeams: ExternalTeam[];
};

export type MemberRole = {
  id: string;
  name: string;
  desc: string;
  allowed?: boolean;
};

/**
 * Returned from /organizations/org/users/
 */
export type Member = {
  dateCreated: string;
  email: string;
  expired: boolean;
  flags: {
    'sso:linked': boolean;
    'sso:invalid': boolean;
    'member-limit:restricted': boolean;
  };
  id: string;
  inviteStatus: 'approved' | 'requested_to_be_invited' | 'requested_to_join';
  invite_link: string | null;
  inviterName: string | null;
  isOnlyOwner: boolean;
  name: string;
  pending: boolean | undefined;
  projects: string[];
  role: string;
  roleName: string;
  roles: MemberRole[]; // TODO(ts): This is not present from API call
  teams: string[];
  user: User;
};

/**
 * Minimal organization shape used on shared issue views.
 */
export type SharedViewOrganization = {
  slug: string;
  id?: string;
  features?: Array<string>;
};

export type AuditLog = {
  id: string;
  actor: User;
  event: string;
  ipAddress: string;
  note: string;
  targetObject: number;
  targetUser: Actor | null;
  data: any;
  dateCreated: string;
};

export type AccessRequest = {
  id: string;
  team: Team;
  member: Member;
  requester?: Partial<{
    name: string;
    username: string;
    email: string;
  }>;
};

/**
 * Discover queries and result sets.
 */
export type SavedQueryVersions = 1 | 2;

export type NewQuery = {
  id: string | undefined;
  version: SavedQueryVersions;
  name: string;
  createdBy?: User;

  // Query and Table
  query?: string;
  fields: Readonly<string[]>;
  widths?: Readonly<string[]>;
  orderby?: string;
  expired?: boolean;

  // GlobalSelectionHeader
  projects: Readonly<number[]>;
  environment?: Readonly<string[]>;
  range?: string;
  start?: string;
  end?: string;

  // Graph
  yAxis?: string[];
  display?: string;
  topEvents?: string;

  teams?: Readonly<('myteams' | number)[]>;
};

export type SavedQuery = NewQuery & {
  id: string;
  dateCreated: string;
  dateUpdated: string;
};

export type SavedQueryState = {
  savedQueries: SavedQuery[];
  hasError: boolean;
  isLoading: boolean;
};

export type EventsStatsData = [number, {count: number; comparisonCount?: number}[]][];
export type EventsGeoData = {'geo.country_code': string; count: number}[];

// API response format for a single series
export type EventsStats = {
  data: EventsStatsData;
  totals?: {count: number};
  order?: number;
  start?: number;
  end?: number;
};

// API response format for multiple series
export type MultiSeriesEventsStats = {
  [seriesName: string]: EventsStats;
};

/**
 * Session API types.
 */
// Base type for series style API response
export type SeriesApi = {
  intervals: string[];
  groups: {
    by: Record<string, string | number>;
    totals: Record<string, number>;
    series: Record<string, number[]>;
  }[];
};

export type SessionApiResponse = SeriesApi & {
  start: string;
  end: string;
  query: string;
};

export enum SessionField {
  SESSIONS = 'sum(session)',
  USERS = 'count_unique(user)',
  DURATION = 'p50(session.duration)',
}

export enum SessionStatus {
  HEALTHY = 'healthy',
  ABNORMAL = 'abnormal',
  ERRORED = 'errored',
  CRASHED = 'crashed',
}
