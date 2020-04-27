import {SpanEntry, TraceContextType} from 'app/components/events/interfaces/spans/types';
import {API_ACCESS_SCOPES} from 'app/constants';
import {Field} from 'app/views/settings/components/forms/type';
import {PlatformKey} from 'app/data/platformCategories';
import {OrgExperiments, UserExperiments} from 'app/types/experiments';
import {
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
} from 'app/views/organizationIntegrations/constants';
import {Props as AlertProps} from 'app/components/alert';

declare global {
  interface Window {
    /**
     * Assets public location
     */
    __sentryGlobalStaticPrefix: string;
    /**
     * The config object provided by the backend.
     */
    __initialData: Config;
    /**
     * Sentry SDK configuration
     */
    __SENTRY__OPTIONS: Config['sentryConfig'];
    /**
     * The authenticated user identity, a bare-bones version of User
     */
    __SENTRY__USER: Config['userIdentity'];
    /**
     * Sentrys version string
     */
    __SENTRY__VERSION?: string;
    /**
     * The CSRF cookie ised on the backend
     */
    csrfCookieName?: string;
    /**
     * Primary entrypoint for rendering the sentry app. This is typically
     * called in the django templates, or in the case of the EXPERIMENTAL_SPA,
     * after config hydration.
     */
    SentryRenderApp: () => void;
    sentryEmbedCallback?: ((embed: any) => void) | null;
  }
}

export type IntegrationInstallationStatus =
  | typeof INSTALLED
  | typeof NOT_INSTALLED
  | typeof PENDING;

export type SentryAppStatus = 'unpublished' | 'published' | 'internal';

export type ObjectStatus =
  | 'active'
  | 'disabled'
  | 'pending_deletion'
  | 'deletion_in_progress';

export type Avatar = {
  avatarUuid: string | null;
  avatarType: 'letter_avatar' | 'upload' | 'gravatar';
};

export type Actor = {
  id: string;
  type: 'user' | 'team';
  name: string;
};

/**
 * Organization summaries are sent when you request a
 * list of all organiations
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
 *
 * Lightweight in this case means it does not contain `projects` or `teams`
 */
export type LightWeightOrganization = OrganizationSummary & {
  scrubIPAddresses: boolean;
  attachmentsRole: string;
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
  role?: string;
  onboardingTasks: OnboardingTaskStatus[];
  trustedRelays: string[];
};

/**
 * Full organization details
 */
export type Organization = LightWeightOrganization & {
  projects: Project[];
  teams: Team[];
};

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  platform?: PlatformKey;
};

export type Project = {
  id: string;
  isMember: boolean;
  teams: Team[];
  features: string[];

  isBookmarked: boolean;
  hasUserReports?: boolean;
  hasAccess: boolean;
  firstEvent: 'string' | null;

  // XXX: These are part of the DetailedProject serializer
  plugins: Plugin[];
  processingIssues: number;
} & AvatarProject;

export type ProjectRelease = {
  version: string;
  dateCreated: string;
  dateReleased: string | null;
  commitCount: number;
  authors: User[];
  newGroups: number;
  healthData: Health | null;
  project: ReleaseProject;
};

export type Health = {
  totalUsers: number;
  totalUsers24h: number | null;
  totalSessions: number;
  totalSessions24h: number | null;
  crashFreeUsers: number | null;
  crashFreeSessions: number | null;
  stats: HealthGraphData;
  sessionsCrashed: number;
  sessionsErrored: number;
  adoption: number | null;
  hasHealthData: boolean;
  durationP50: number | null;
  durationP90: number | null;
};

export type HealthGraphData = Record<string, [number, number][]>;

export type Team = {
  id: string;
  slug: string;
  isMember: boolean;
  avatar: Avatar;
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
  event_id: string;
};

export type EntryTypeData = {[key: string]: any | any[]};

type EntryType = {
  data: EntryTypeData;
  type: string;
};

export type EventTag = {key: string; value: string};

export type EventUser = {
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
  context?: {[key: string]: any};
  packages?: {[key: string]: string};
  user: EventUser;
  message: string;
  platform?: PlatformKey;
  dateCreated?: string;
  endTimestamp?: number;
  entries: EntryType[];

  previousEventID?: string;
  nextEventID?: string;
  projectSlug: string;
  projectID: string;

  tags: EventTag[];

  size: number;

  location: string;

  oldestEventID: string | null;
  latestEventID: string | null;
};

export type SentryTransactionEvent = {
  type: 'transaction';
  title?: string;
  entries: SpanEntry[];
  startTimestamp: number;
  endTimestamp: number;
  sdk?: {
    name?: string;
  };
  contexts?: {
    trace?: TraceContextType;
  };
} & SentryEventBase;

// This type is incomplete
export type Event = ({type: string} & SentryEventBase) | SentryTransactionEvent;

export type EventsStatsData = [number, {count: number}[]][];

// API response format for a single series
export type EventsStats = {
  data: EventsStatsData;
  totals?: {count: number};
  order?: number;
};

// API response format for multiple series
export type MultiSeriesEventsStats = {[seriesName: string]: EventsStats};

/**
 * Avatars are a more primitive version of User.
 */
export type AvatarUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  avatar?: Avatar;
  ip_address: string;
  // Compatibility shim with EventUser serializer
  ipAddress?: string;
  options?: {
    avatarType: string;
  };
  lastSeen?: string;
};

/**
 * This is an authenticator that a user is enrolled in
 */
type UserEnrolledAuthenticator = {
  dateUsed: EnrolledAuthenticator['lastUsedAt'];
  dateCreated: EnrolledAuthenticator['createdAt'];
  type: Authenticator['id'];
  id: EnrolledAuthenticator['authId'];
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
  authenticators: UserEnrolledAuthenticator[];
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
  experiments: Partial<UserExperiments>;
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

export type PluginNoProject = {
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
  version?: string;
  author?: {name: string; url: string};
  isHidden: boolean;
  description?: string;
  resourceLinks?: Array<{title: string; url: string}>;
  features: string[];
  featureDescriptions: IntegrationFeature[];
};

export type Plugin = PluginNoProject & {
  enabled: boolean;
};

export type PluginProjectItem = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  projectPlatform: PlatformKey;
  enabled: boolean;
  configured: boolean;
};

export type PluginWithProjectList = PluginNoProject & {
  projectList: PluginProjectItem[];
};

export type AppOrProviderOrPlugin =
  | SentryApp
  | IntegrationProvider
  | PluginWithProjectList
  | DocumentIntegration;

export type DocumentIntegration = {
  slug: string;
  name: string;
  author: string;
  docUrl: string;
  description: string;
  features: IntegrationFeature[];
  resourceLinks: Array<{title: string; url: string}>;
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

export type Authenticator = {
  /**
   * String used to display on button for user as CTA to enroll
   */
  enrollButton: string;

  /**
   * Display name for the authenticator
   */
  name: string;

  /**
   * Allows multiple enrollments to authenticator
   */
  allowMultiEnrollment: boolean;

  /**
   * String to display on button for user to remove authenticator
   */
  removeButton: string | null;

  canValidateOtp: boolean;

  /**
   * Is user enrolled to this authenticator
   */
  isEnrolled: boolean;

  /**
   * String to display on button for additional information about authenticator
   */
  configureButton: string;

  /**
   * Type of authenticator
   */
  id: string;

  /**
   * Is this used as a backup interface?
   */
  isBackupInterface: boolean;

  /**
   * Description of the authenticator
   */
  description: string;
} & Partial<EnrolledAuthenticator>;

export type EnrolledAuthenticator = {
  lastUsedAt: string | null;
  createdAt: string;
  authId: string;
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
  lastOrganization: string | null;
  gravatarBaseUrl: string;
  messages: string[];
  dsn: string;
  userIdentity: {ip_address: string; email: string; id: string; isStaff: boolean};
  termsUrl: string | null;
  isAuthenticated: boolean;
  version: {
    current: string;
    build: string;
    upgradeAvailable: boolean;
    latest: string;
  };
  statuspage?: {
    id: string;
    api_host: string;
  };
  sentryConfig: {
    dsn: string;
    release: string;
    whitelistUrls: string[];
  };
  distPrefix: string;
  apmSampling: number;
  dsn_requests: string;
};

export type EventOrGroupType =
  | 'error'
  | 'csp'
  | 'hpkp'
  | 'expectct'
  | 'expectstaple'
  | 'default'
  | 'transaction';

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
  level: Level;
  logger: string;
  metadata: EventMetadata;
  numComments: number;
  participants: any[]; // TODO(ts)
  permalink: string;
  platform: PlatformKey;
  pluginActions: any[]; // TODO(ts)
  pluginContexts: any[]; // TODO(ts)
  pluginIssues: any[]; // TODO(ts)
  project: Project;
  seenBy: User[];
  shareId: string;
  shortId: string;
  stats: any; // TODO(ts)
  status: string;
  statusDetails: ResolutionStatusDetails;
  title: string;
  type: EventOrGroupType;
  userCount: number;
  userReportCount: number;
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

export type AccessRequest = {
  id: string;
  team: Team;
  member: Member;
};

export type Repository = {
  dateCreated: string;
  externalSlug: string;
  id: string;
  integrationId: string;
  name: string;
  provider: {id: string; name: string};
  status: RepositoryStatus;
  url: string;
};

export enum RepositoryStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  HIDDEN = 'hidden',
  PENDING_DELETION = 'pending_deletion',
  DELETION_IN_PROGRESS = 'deletion_in_progress',
}

export type PullRequest = {
  id: string;
  title: string;
  externalUrl: string;
};

type IntegrationDialog = {
  actionText: string;
  body: string;
};

type IntegrationAspects = {
  alerts?: Array<AlertProps & {text: string}>;
  reauthentication_alert?: {alertText: string};
  disable_dialog?: IntegrationDialog;
  removal_dialog?: IntegrationDialog;
  externalInstall?: {
    url: string;
    buttonText: string;
    noticeText: string;
  };
};

type BaseIntegrationProvider = {
  key: string;
  slug: string;
  name: string;
  canAdd: boolean;
  canDisable: boolean;
  features: string[];
};

export type IntegrationProvider = BaseIntegrationProvider & {
  setupDialog: {url: string; width: number; height: number};
  metadata: {
    description: string;
    features: IntegrationFeature[];
    author: string;
    noun: string;
    issue_url: string;
    source_url: string;
    aspects: IntegrationAspects;
  };
};

export type IntegrationFeature = {
  description: string;
  featureGate: string;
};

export type WebhookEvent = 'issue' | 'error';

export type Scope = typeof API_ACCESS_SCOPES[number];

export type SentryAppSchemaIssueLink = {
  type: 'issue-link';
  create: {
    uri: string;
    required_fields: any[];
    optional_fields?: any[];
  };
  link: {
    uri: string;
    required_fields: any[];
    optional_fields?: any[];
  };
};

export type SentryAppSchemaStacktraceLink = {
  type: 'stacktrace-link';
  uri: string;
};

export type SentryAppSchemaElement =
  | SentryAppSchemaIssueLink
  | SentryAppSchemaStacktraceLink;

export type SentryApp = {
  status: SentryAppStatus;
  scopes: Scope[];
  isAlertable: boolean;
  verifyInstall: boolean;
  slug: string;
  name: string;
  uuid: string;
  author: string;
  events: WebhookEvent[];
  schema: {
    elements?: SentryAppSchemaElement[];
  };
  //possible null params
  webhookUrl: string | null;
  redirectUrl: string | null;
  overview: string | null;
  //optional params below
  datePublished?: string;
  clientId?: string;
  clientSecret?: string;
  owner?: {
    id: number;
    slug: string;
  };
  featureData: IntegrationFeature[];
};

export type Integration = {
  id: string;
  name: string;
  icon: string;
  domainName: string;
  accountType: string;
  status: ObjectStatus;
  provider: BaseIntegrationProvider & {aspects: IntegrationAspects};
  configOrganization: Field[];
  //TODO(ts): This includes the initial data that is passed into the integration's configuration form
  configData: object & {
    //installationType is only for Slack migration and can be removed after migrations are done
    installationType?:
      | 'workspace_app'
      | 'classic_bot'
      | 'born_as_bot'
      | 'migrated_to_bot';
  };
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
  errorUrl?: string;
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
  name: string;
  event: {eventID: string; id: string};
  user: User;
  dateCreated: string;
  comments: string;
  email: string;
};

export type Release = {
  commitCount: number;
  data: {};
  lastDeploy?: Deploy;
  deployCount: number;
  lastEvent: string;
  firstEvent: string;
  lastCommit?: Commit;
  authors: User[];
  owner?: any; // TODO(ts)
  newGroups: number;
  projects: ReleaseProject[];
} & BaseRelease;

export type ReleaseProject = {
  slug: string;
  name: string;
  id: number;
  platform: string;
  platforms: string[];
  healthData: Health;
};

export type BaseRelease = {
  dateReleased: string;
  url: string;
  dateCreated: string;
  version: string;
  shortVersion: string;
  ref: string;
};

export type Deploy = {
  id: string;
  name: string;
  url: string;
  environment: string;
  dateStarted: string;
  dateFinished: string;
};

export type Commit = {
  id: string;
  key: string;
  message: string;
  dateCreated: string;
  repository?: Repository;
  author?: User;
  releases: BaseRelease[];
};

export type CommitFile = {
  id: string;
  author: CommitAuthor;
  commitMessage: string;
  filename: string;
  orgId: number;
  repoName: string;
  type: string;
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
  schema: SentryAppSchemaIssueLink;
  sentryApp: {
    uuid: string;
    slug: string;
    name: string;
  };
};

type SavedQueryVersions = 1 | 2;

export type NewQuery = {
  id: string | undefined;
  version: SavedQueryVersions;
  name: string;
  projects: Readonly<number[]>;
  fields: Readonly<string[]>;
  widths?: Readonly<string[]>;
  query: string;
  orderby?: string;
  range?: string;
  start?: string;
  end?: string;
  environment?: Readonly<string[]>;
  tags?: Readonly<string[]>;
  yAxis?: string;
  display?: string;
  createdBy?: User;
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

export type SelectValue<T> = {
  label: string;
  value: T;
};

/**
 * The issue config form fields we get are basically the form fields we use in
 * the UI but with some extra information. Some fields marked optional in the
 * form field are guaranteed to exist so we can mark them as required here
 */
export type IssueConfigField = Field & {
  name: string;
  default?: string;
  choices?: [number | string, number | string][];
  url?: string;
  multiple?: boolean;
};

export type IntegrationIssueConfig = {
  status: ObjectStatus;
  name: string;
  domainName: string;
  linkIssueConfig?: IssueConfigField[];
  createIssueConfig?: IssueConfigField[];
  provider: IntegrationProvider;
  icon: string[];
};

export enum OnboardingTaskKey {
  FIRST_PROJECT = 'create_project',
  FIRST_EVENT = 'send_first_event',
  INVITE_MEMBER = 'invite_member',
  SECOND_PLATFORM = 'setup_second_platform',
  USER_CONTEXT = 'setup_user_context',
  RELEASE_TRACKING = 'setup_release_tracking',
  SOURCEMAPS = 'setup_sourcemaps',
  USER_REPORTS = 'setup_user_reports',
  ISSUE_TRACKER = 'setup_issue_tracker',
  ALERT_RULE = 'setup_alert_rules',
}

export type OnboardingSupplementComponentProps = {
  task: OnboardingTask;
  onCompleteTask: () => void;
};

export type OnboardingTaskDescriptor = {
  task: OnboardingTaskKey;
  title: string;
  description: string;
  detailedDescription?: string;
  /**
   * Can this task be skipped?
   */
  skippable: boolean;
  /**
   * A list of require task keys that must have been completed before these
   * tasks may be completed.
   */
  requisites: OnboardingTaskKey[];
  /**
   * Should the onboarding task currently be displayed
   */
  display: boolean;
  /**
   * An extra component that may be rendered within the onboarding task item.
   */
  SupplementComponent?: React.ComponentType<OnboardingSupplementComponentProps>;
} & (
  | {
      actionType: 'app' | 'external';
      location: string;
    }
  | {
      actionType: 'action';
      action: () => void;
    }
);

export type OnboardingTaskStatus = {
  task: OnboardingTaskKey;
  status: 'skipped' | 'pending' | 'complete';
  user?: AvatarUser | null;
  dateCompleted?: string;
  completionSeen?: string;
  data?: object;
};

export type OnboardingTask = OnboardingTaskStatus &
  OnboardingTaskDescriptor & {
    /**
     * Onboarding tasks that are currently incomplete and must be completed
     * before this task should be completed.
     */
    requisiteTasks: OnboardingTask[];
  };

export type Tag = {
  name: string;
  key: string;
  values?: string[];
  totalValues?: number;
  predefined?: boolean;
};

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

export type Level = 'error' | 'fatal' | 'info' | 'warning' | 'sample';

export type Meta = {
  chunks: Array<Chunks>;
  len: number;
  rem: Array<Array<string | number>>;
  err: Array<any>;
};

export type Chunks = {
  text: string;
  type: string;
  remark?: string;
  rule_id?: string;
};

export enum ResolutionStatus {
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
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

export type Broadcast = {
  id: string;
  message: string;
  title: string;
  link: string;
  cta: string;
  isActive: boolean;
  dateCreated: string;
  dateExpires: string;
  hasSeen: boolean;
};

export type SentryServiceIncident = {
  id: string;
  name: string;
  updates?: string[];
  url: string;
  status: string;
};

export type SentryServiceStatus = {
  indicator: 'major' | 'minor' | 'none';
  incidents: SentryServiceIncident[];
  url: string;
};

export type CrashFreeTimeBreakdown = {
  date: string;
  totalSessions: number;
  crashFreeSessions: number | null;
  crashFreeUsers: number | null;
  totalUsers: number;
}[];

export type Activity = {
  data: any;
  dateCreated: string;
  type: string;
  id: string;
  issue?: Group;
  project: Project;
  user?: User;
};
