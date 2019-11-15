import {SpanEntry} from 'app/components/events/interfaces/spans/types';
import {API_SCOPES} from 'app/constants';
import {Field} from 'app/views/settings/components/forms/type';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

export type ObjectStatus =
  | 'active'
  | 'disabled'
  | 'pending_deletion'
  | 'deletion_in_progress';

export type LightWeightOrganization = {
  id: string;
  slug: string;
  name: string;
  access: string[];
  features: string[];
};

export type Organization = LightWeightOrganization & {
  projects: Project[];
  teams: Team[];
};

export type OrganizationDetailed = Organization & {
  isDefault: boolean;
  defaultRole: string;
  availableRoles: {id: string; name: string}[];
  openMembership: boolean;
  require2FA: boolean;
  allowSharedIssues: boolean;
  enhancedPrivacy: boolean;
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  sensitiveFields: string[];
  safeFields: string[];
  storeCrashReports: boolean;
  attachmentsRole: string;
  scrubIPAddresses: boolean;
  scrapeJavaScript: boolean;
  trustedRelays: string[];
  role?: string;
  experiments: ActiveExperiments;
};

export type Project = {
  id: string;
  slug: string;
  isMember: boolean;
  teams: Team[];
  features: string[];

  isBookmarked: boolean;
  hasUserReports?: boolean;
  hasAccess: boolean;
};

export type Team = {
  id: string;
  slug: string;
  isMember: boolean;
};

export type TeamWithProjects = Team & {projects: Project[]};

// This type is incomplete
export type EventMetadata = {
  value?: string;
  message?: string;
  directive?: string;
  type?: string;
  title?: string;
  uri?: string;
  filename?: string;
  origin?: string;
  function?: string;
};

export type EventAttachment = {
  id: string;
  dateCreated: string;
  headers: Object;
  name: string;
  sha1: string;
  size: number;
  type: string;
};

type EntryType = {
  data: {[key: string]: any} | any[];
  type: string;
};

export type EventTag = {key: string; value: string};

type EventUser = {
  username?: string;
  name?: string;
  ip_address?: string;
  email?: string;
  id?: string;
};

type RuntimeContext = {
  type: 'runtime';
  version: number;
  build?: string;
  name?: string;
};

type TraceContext = {
  type: 'trace';
  op: string;
  description: string;
  parent_span_id: string;
  span_id: string;
  trace_id: string;
};

type EventContexts = {
  runtime?: RuntimeContext;
  trace?: TraceContext;
};

type SentryEventBase = {
  id: string;
  eventID: string;
  groupID?: string;
  title: string;
  culprit: string;
  metadata: EventMetadata;
  contexts: EventContexts;
  user: EventUser;
  message: string;
  platform?: string;
  dateCreated?: string;
  endTimestamp?: number;
  entries: EntryType[];

  previousEventID?: string;
  nextEventID?: string;
  projectSlug: string;

  tags: EventTag[];

  size: number;

  location: string;

  oldestEventID: string | null;
  latestEventID: string | null;
};

// This type is incomplete
export type Event =
  | ({type: string} & SentryEventBase)
  | {
      type: 'transaction';
      entries: SpanEntry[];
      startTimestamp: number;
      endTimestamp: number;
    } & SentryEventBase;

export type EventsStatsData = [number, {count: number}[]][];

export type EventsStats = {
  data: EventsStatsData;
  totals?: {count: number};
};

// Avatars are a more primitive version of User.
export type AvatarUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  avatar: {
    avatarUuid: string | null;
    avatarType: 'letter_avatar' | 'upload';
  };
  ip_address: string;
  options?: {
    avatarType: string;
  };
};

export type User = AvatarUser & {
  lastLogin: string;
  isSuperuser: boolean;
  emails: {
    is_verified: boolean;
    id: string;
    email: string;
  }[];
  isManaged: boolean;
  lastActive: string;
  isStaff: boolean;
  identities: any[];
  isActive: boolean;
  has2fa: boolean;
  canReset2fa: boolean;
  authenticators: Authenticator[];
  dateJoined: string;
  options: {
    timezone: string;
    stacktraceOrder: number;
    language: string;
    clock24Hours: boolean;
    avatarType: string;
  };
  flags: {newsletter_consent_prompt: boolean};
  hasPasswordAuth: boolean;
  permissions: Set<string>;
};

export type CommitAuthor = {
  email?: string;
  name?: string;
};

// TODO(ts): This type is incomplete
export type Environment = {
  name: string;
  id: string;
};

// TODO(ts): This type is incomplete
export type SavedSearch = {};

export type Plugin = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  type: string;
  canDisable: boolean;
  isTestable: boolean;
  hasConfiguration: boolean;
  metadata: any; // TODO(ts)
  contexts: any[]; // TODO(ts)
  status: string;
  assets: any[]; // TODO(ts)
  doc: string;
  enabled?: boolean;
  version?: string;
  author?: {name: string; url: string};
  isHidden: boolean;
  description?: string;
  resourceLinks?: Array<{title: string; url: string}>;
};

export type GlobalSelection = {
  projects: number[];
  environments: string[];
  forceUrlSync?: boolean;
  datetime: {
    start: Date | null;
    end: Date | null;
    period: string;
    utc: boolean;
  };
};

type Authenticator = {
  dateUsed: string | null;
  dateCreated: string;
  type: string; // i.e. 'u2f'
  id: string;
  name: string;
};

export type Config = {
  languageCode: string;
  csrfCookieName: string;
  features: Set<string>;
  singleOrganization: boolean;
  urlPrefix: string;
  needsUpgrade: boolean;
  supportEmail: string;
  user: User;

  invitesEnabled: boolean;
  privacyUrl: string | null;
  isOnPremise: boolean;
  lastOrganization: string;
  gravatarBaseUrl: string;
  messages: string[];
  dsn: string;
  userIdentity: {ip_address: string; email: string; id: number};
  termsUrl: string | null;
  isAuthenticated: boolean;
  version: {
    current: string;
    build: string;
    upgradeAvailable: boolean;
    latest: string;
  };
  statuspage: string | null;
  sentryConfig: {
    dsn: string;
    release: string;
    whitelistUrls: string[];
  };
  distPrefix: string;
};

type Metadata = {
  value: string;
  message: string;
  directive: string;
  type: string;
  title: string;
  uri: string;
};

type EventOrGroupType = [
  'error',
  'csp',
  'hpkp',
  'expectct',
  'expectstaple',
  'default',
  'transaction'
];

// TODO(ts): incomplete
export type Group = {
  id: string;
  activity: any[]; // TODO(ts)
  annotations: string[];
  assignedTo: User;
  count: string;
  culprit: string;
  currentRelease: any; // TODO(ts)
  firstRelease: any; // TODO(ts)
  firstSeen: string;
  hasSeen: boolean;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  lastRelease: any; // TODO(ts)
  lastSeen: string;
  level: string;
  logger: string;
  metadata: Metadata;
  numComments: number;
  participants: any[]; // TODO(ts)
  permalink: string;
  platform: string;
  pluginActions: any[]; // TODO(ts)
  pluginContexts: any[]; // TODO(ts)
  pluginIssues: any[]; // TODO(ts)
  project: Project;
  seenBy: User[];
  shareId: string;
  shortId: string;
  stats: any; // TODO(ts)
  status: string;
  statusDetails: {};
  title: string;
  type: EventOrGroupType;
  userCount: number;
  userReportCount: number;
};

export type Member = {
  id: string;
  user: User;
  name: string;
  email: string;
  pending: boolean | undefined;
  role: string;
  roleName: string;
  flags: {
    'sso:linked': boolean;
    'sso:invalid': boolean;
  };
  dateCreated: string;
  inviteStatus: 'approved' | 'requested_to_be_invited' | 'requested_to_join';
  inviterName: string | null;
  teams: string[];
};

export type AccessRequest = {
  id: string;
  team: Team;
  member: Member;
};

export type EventViewv1 = {
  name: string;
  data: {
    fields: string[];
    fieldnames: string[];
    sort: string[];
    query?: string;
  };
  tags: string[];
  statsPeriod?: string;
};

export type Repository = {
  dateCreated: string;
  externalSlug: string;
  id: string;
  integrationId: string;
  name: string;
  provider: {id: string; name: string};
  status: string;
  url: string;
};

export type IntegrationProvider = {
  key: string;
  name: string;
  canAdd: boolean;
  canDisable: boolean;
  features: string[];
  aspects: any; //TODO(ts)
  setupDialog: object; //TODO(ts)
  metadata: any; //TODO(ts)
};

export type IntegrationFeature = {
  description: React.ReactNode;
  featureGate: string;
};

export type WebhookEvent = 'issue' | 'error';

export type Scope = typeof API_SCOPES[number];

export type SentryApp = {
  status: 'unpublished' | 'published' | 'internal';
  scopes: Scope[];
  isAlertable: boolean;
  verifyInstall: boolean;
  slug: string;
  name: string;
  uuid: string;
  author: string;
  events: WebhookEvent[];
  schema: {
    elements?: object[]; //TODO(ts)
  };
  //possible null params
  webhookUrl: string | null;
  redirectUrl: string | null;
  overview: string | null;
  //optional params below
  clientId?: string;
  clientSecret?: string;
  owner?: {
    id: number;
    slug: string;
  };
};

export type Integration = {
  id: string;
  name: string;
  icon: string;
  domainName: string;
  accountType: string;
  status: ObjectStatus;
  provider: IntegrationProvider;
  configOrganization: Field[];
  //TODO(ts): This includes the initial data that is passed into the integration's configuration form
  configData: object;
};

export type IntegrationExternalIssue = {
  id: string;
  key: string;
  url: string;
  title: string;
  description: string;
  displayName: string;
};

export type GroupIntegration = Integration & {
  externalIssues: IntegrationExternalIssue[];
};

export type PlatformExternalIssue = {
  id: string;
  groupId: string;
  serviceType: string;
  displayName: string;
  webUrl: string;
};

export type SentryAppInstallation = {
  app: {
    uuid: string;
    slug: string;
  };
  organization: {
    slug: string;
  };
  uuid: string;
  status: 'installed' | 'pending';
  code?: string;
};

export type SentryAppWebhookRequest = {
  webhookUrl: string;
  sentryAppSlug: string;
  eventType: string;
  date: string;
  organization?: {
    slug: string;
    name: string;
  };
  responseCode: number;
};

export type PermissionValue = 'no-access' | 'read' | 'write' | 'admin';

export type Permissions = {
  Event: PermissionValue;
  Member: PermissionValue;
  Organization: PermissionValue;
  Project: PermissionValue;
  Release: PermissionValue;
  Team: PermissionValue;
};

//See src/sentry/api/serializers/models/apitoken.py for the differences based on application
type BaseApiToken = {
  id: string;
  scopes: Scope[];
  expiresAt: string;
  dateCreated: string;
  state: string;
};

//We include the token for API tokens used for internal apps
export type InternalAppApiToken = BaseApiToken & {
  application: null;
  token: string;
  refreshToken: string;
};

export type ApiApplication = {
  allowedOrigins: string[];
  clientID: string;
  clientSecret: string | null;
  homepageUrl: string | null;
  id: string;
  name: string;
  privacyUrl: string | null;
  redirectUris: string[];
  termsUrl: string | null;
};

export type UserReport = {
  id: string;
  eventID: string;
  issue: Group;
};

export type Commit = {
  id: string;
  key: string;
  message: string;
  dateCreated: string;
  repository?: Repository;
  author?: User;
};

export type MemberRole = {
  id: string;
  name: string;
  desc: string;
  allowed?: boolean;
};

export type SentryAppComponent = {
  uuid: string;
  type: 'issue-link' | 'alert-rule-action' | 'issue-media' | 'stacktrace-link';
  schema: object;
  sentryApp: {
    uuid: string;
    slug: string;
    name: string;
  };
};

export type RouterProps = {
  params: Params;
  location: Location;
};

export type ActiveExperiments = {
  ImprovedInvitesExperiment: 'none' | 'all' | 'join_request' | 'invite_request';
  TrialUpgradeV2Experiment: 'upgrade' | 'trial' | -1;
};
