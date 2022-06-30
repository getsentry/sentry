import type {Actor, Avatar, ObjectStatus, Scope} from './core';
import type {OrgExperiments} from './experiments';
import type {ExternalTeam} from './integrations';
import type {OnboardingTaskStatus} from './onboarding';
import type {Relay} from './relay';
import type {User} from './user';

/**
 * Organization summaries are sent when you request a list of all organizations
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
    id: ObjectStatus;
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
  availableRoles: {id: string; name: string}[]; // Deprecated, use orgRoleList
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
  orgRoleList: OrgRole[];
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
  teamRoleList: TeamRole[];
  trustedRelays: Relay[];
  orgRole?: string;
  /**
   * @deprecated use orgRole instead
   */
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
  teamRole: string | null;
};

// TODO: Rename to BaseRole
export type MemberRole = {
  desc: string;
  id: string;
  name: string;
  allowed?: boolean;
};
export type OrgRole = MemberRole & {
  minimumTeamRole: string;
  isGlobal?: boolean;
  isRetired?: boolean;
  is_global?: boolean; // Deprecated: use isGlobal
};
export type TeamRole = MemberRole & {
  isMinimumRoleFor: string;
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
  orgRole: OrgRole['id'];
  orgRoleList: OrgRole[]; // TODO: Move to global store
  pending: boolean | undefined;
  projects: string[];

  // Avoid using these keys
  role: OrgRole['id']; // Deprecated: use orgRole
  roleName: string;
  roles: OrgRole[]; // Deprecated: use orgRoleList

  teamRoleList: TeamRole[]; // TODO: Move to global store
  teamRoles: {
    role: string | null;
    teamSlug: string;
  }[];
  teams: string[]; // # Deprecated, use teamRoles

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
  utc?: boolean | string;
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
  isMetricsData?: boolean;
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

export enum SessionFieldWithOperation {
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
