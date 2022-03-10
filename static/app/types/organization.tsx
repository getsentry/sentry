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
  avatar: Avatar;
  dateCreated: string;
  features: string[];
  id: string;
  isEarlyAdopter: boolean;
  name: string;
  require2FA: boolean;
  slug: string;
  status: {
    // TODO(ts): Are these fields == `ObjectStatus`?
    id: string;
    name: string;
  };
};

/**
 * Detailed organization (e.g. when requesting details for a single org)
 */
export type Organization = OrganizationSummary & {
  access: Scope[];
  alertsMemberWrite: boolean;
  allowJoinRequests: boolean;
  allowSharedIssues: boolean;
  attachmentsRole: string;
  availableRoles: {id: string; name: string}[];
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  debugFilesRole: string;
  defaultRole: string;
  enhancedPrivacy: boolean;
  eventsMemberAdmin: boolean;
  experiments: Partial<OrgExperiments>;
  isDefault: boolean;
  onboardingTasks: OnboardingTaskStatus[];
  openMembership: boolean;
  pendingAccessRequests: number;
  quota: {
    accountLimit: number | null;
    maxRate: number | null;
    maxRateInterval: number | null;
    projectLimit: number | null;
  };
  relayPiiConfig: string;
  safeFields: string[];
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  storeCrashReports: number;
  trustedRelays: Relay[];
  role?: string;
};

export type Team = {
  avatar: Avatar;
  externalTeams: ExternalTeam[];
  hasAccess: boolean;
  id: string;
  isMember: boolean;
  isPending: boolean;
  memberCount: number;
  name: string;
  slug: string;
};

export type MemberRole = {
  desc: string;
  id: string;
  name: string;
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
    'member-limit:restricted': boolean;
    'sso:invalid': boolean;
    'sso:linked': boolean;
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

export type NewQuery = {
  fields: Readonly<string[]>;
  id: string | undefined;
  name: string;
  // GlobalSelectionHeader
  projects: Readonly<number[]>;

  version: SavedQueryVersions;
  createdBy?: User;
  display?: string;
  end?: string;
  environment?: Readonly<string[]>;

  expired?: boolean;
  orderby?: string;
  // Query and Table
  query?: string;
  range?: string;
  start?: string;

  teams?: Readonly<('myteams' | number)[]>;
  topEvents?: string;
  widths?: Readonly<string[]>;

  // Graph
  yAxis?: string[];
};

export type SavedQuery = NewQuery & {
  dateCreated: string;
  dateUpdated: string;
  id: string;
};

export type SavedQueryState = {
  hasError: boolean;
  isLoading: boolean;
  savedQueries: SavedQuery[];
};

export type EventsStatsData = [number, {count: number; comparisonCount?: number}[]][];
export type EventsGeoData = {count: number; 'geo.country_code': string}[];

// API response format for a single series
export type EventsStats = {
  data: EventsStatsData;
  end?: number;
  order?: number;
  start?: number;
  totals?: {count: number};
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
  groups: {
    by: Record<string, string | number>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }[];
  intervals: string[];
};

export type SessionApiResponse = SeriesApi & {
  end: string;
  query: string;
  start: string;
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
