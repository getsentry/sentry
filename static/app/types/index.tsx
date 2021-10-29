// XXX(epurkhiser): When we switch to the new React JSX runtime we will no
// longer need this import and can drop babel-preset-css-prop for babel-preset.
/// <reference types="@emotion/react/types/css-prop" />

import {FocusTrap} from 'focus-trap';
import u2f from 'u2f-api';

import exportGlobals from 'app/bootstrap/exportGlobals';
import Alert from 'app/components/alert';
import {getInterval} from 'app/components/charts/utils';
import {SymbolicatorStatus} from 'app/components/events/interfaces/types';
import {API_ACCESS_SCOPES, DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {PlatformKey} from 'app/data/platformCategories';
import {OrgExperiments, UserExperiments} from 'app/types/experiments';
import {
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
} from 'app/views/organizationIntegrations/constants';
import {Field} from 'app/views/settings/components/forms/type';

import {DynamicSamplingRules} from './dynamicSampling';
import {Event} from './event';
import {RawStacktrace, StackTraceMechanism, StacktraceType} from './stacktrace';

export enum SentryInitRenderReactComponent {
  INDICATORS = 'Indicators',
  SETUP_WIZARD = 'SetupWizard',
  SYSTEM_ALERTS = 'SystemAlerts',
  U2F_SIGN = 'U2fSign',
}

export type OnSentryInitConfiguration =
  | {
      name: 'passwordStrength';
      input: string;
      element: string;
    }
  | {
      name: 'renderReact';
      container: string;
      component: SentryInitRenderReactComponent;
      props?: Record<string, any>;
    }
  | {
      name: 'onReady';
      onReady: (globals: typeof exportGlobals) => void;
    };

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
     * Pipeline
     */
    __pipelineInitialData: PipelineInitialData;

    /**
     * This allows our server-rendered templates to push configuration that should be
     * run after we render our main application.
     *
     * An example of this is dynamically importing the `passwordStrength` module only
     * on the organization login page.
     */
    __onSentryInit:
      | OnSentryInitConfiguration[]
      | {
          push: (config: OnSentryInitConfiguration) => void;
        };

    /**
     * Sentrys version string
     */
    __SENTRY__VERSION?: string;
    /**
     * The CSRF cookie ised on the backend
     */
    csrfCookieName?: string;
    /**
     * Used to open tooltips for testing purposes.
     */
    __openAllTooltips: () => void;
    /**
     * Used to close tooltips for testing purposes.
     */
    __closeAllTooltips: () => void;
    /**
     * Primary entrypoint for rendering the sentry app. This is typically
     * called in the django templates, or in the case of the EXPERIMENTAL_SPA,
     * after config hydration.
     */
    SentryRenderApp: () => void;
    sentryEmbedCallback?: ((embed: any) => void) | null;
    /**
     * Set to true if adblock could be installed.
     * See sentry/js/ads.js for how this global is disabled.
     */
    adblockSuspected?: boolean;

    // typing currently used for demo add on
    // TODO: improve typing
    SentryApp?: {
      HookStore: any;
      ConfigStore: any;
      Modal: any;
      modalFocusTrap?: {
        current?: FocusTrap;
      };
      getModalPortal: () => HTMLElement;
    };
  }
}

export type PipelineInitialData = {
  name: string;
  props: Record<string, any>;
};

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
  avatarType: 'letter_avatar' | 'upload' | 'gravatar' | 'background';
};

export type Actor = {
  type: 'user' | 'team';
  id: string;
  name: string;
  email?: string;
};

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

export type Relay = {
  publicKey: string;
  name: string;
  created?: string;
  lastModified?: string;
  description?: string;
};

export type RelayActivity = {
  publicKey: string;
  relayId: string;
  version: string;
  firstSeen: string;
  lastSeen: string;
};

export type RelaysByPublickey = {
  [publicKey: string]: {
    name: string;
    activities: Array<RelayActivity>;
    description?: string;
    created?: string;
  };
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

/**
 * Minimal organization shape used on shared issue views.
 */
export type SharedViewOrganization = {
  slug: string;
  id?: string;
  features?: Array<string>;
};

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  platform?: PlatformKey;
  id?: string | number;
};

/**
 * Simple timeseries data used in groups, projects and release health.
 */
export type TimeseriesValue = [timestamp: number, value: number];

export type Project = {
  id: string;
  dateCreated: string;
  isMember: boolean;
  teams: Team[];
  features: string[];
  organization: Organization;

  isBookmarked: boolean;
  isInternal: boolean;
  hasUserReports?: boolean;
  hasAccess: boolean;
  hasSessions: boolean;
  firstEvent: 'string' | null;
  firstTransactionEvent: boolean;
  subjectTemplate: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  environments: string[];
  eventProcessing: {
    symbolicationDegraded: boolean;
  };

  // XXX: These are part of the DetailedProject serializer
  dynamicSampling: {
    next_id: number;
    rules: DynamicSamplingRules;
  } | null;
  plugins: Plugin[];
  processingIssues: number;
  relayPiiConfig: string;
  groupingConfig: string;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  builtinSymbolSources?: string[];
  symbolSources?: string;
  stats?: TimeseriesValue[];
  transactionStats?: TimeseriesValue[];
  latestRelease?: Release;
  options?: Record<string, boolean | string>;
  sessionStats?: {
    currentCrashFreeRate: number | null;
    previousCrashFreeRate: number | null;
    hasHealthData: boolean;
  };
} & AvatarProject;

export type MinimalProject = Pick<Project, 'id' | 'slug' | 'platform'>;

// Response from project_keys endpoints.
export type ProjectKey = {
  id: string;
  name: string;
  label: string;
  public: string;
  secret: string;
  projectId: string;
  isActive: boolean;
  rateLimit: {
    window: string;
    count: number;
  } | null;
  dsn: {
    secret: string;
    public: string;
    csp: string;
    security: string;
    minidump: string;
    unreal: string;
    cdn: string;
  };
  browserSdkVersion: string;
  browserSdk: {
    choices: [key: string, value: string][];
  };
  dateCreated: string;
};

export type Health = {
  totalUsers: number;
  totalUsers24h: number | null;
  totalProjectUsers24h: number | null;
  totalSessions: number;
  totalSessions24h: number | null;
  totalProjectSessions24h: number | null;
  crashFreeUsers: number | null;
  crashFreeSessions: number | null;
  stats: HealthGraphData;
  sessionsCrashed: number;
  sessionsErrored: number;
  adoption: number | null;
  sessionsAdoption: number | null;
  hasHealthData: boolean;
  durationP50: number | null;
  durationP90: number | null;
};

export type HealthGraphData = Record<string, TimeseriesValue[]>;

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

export type TeamWithProjects = Team & {projects: Project[]};

export type TreeLabelPart =
  | string
  | {
      function?: string;
      package?: string;
      type?: string;
      classbase?: string;
      filebase?: string;
      datapath?: (string | number)[];
      // is_sentinel is no longer being used,
      // but we will still assess whether we will use this property in the near future.
      is_sentinel?: boolean;
      is_prefix?: boolean;
    };

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
  stripped_crash?: boolean;
  current_tree_label?: TreeLabelPart[];
  finest_tree_label?: TreeLabelPart[];
  current_level?: number;
};

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

export type EntryData = Record<string, any | Array<any>>;

type EnableIntegrationSuggestion = {
  type: 'enableIntegration';
  integrationName: string;
  enables: Array<SDKUpdatesSuggestion>;
  integrationUrl?: string | null;
};

export type UpdateSdkSuggestion = {
  type: 'updateSdk';
  sdkName: string;
  newSdkVersion: string;
  enables: Array<SDKUpdatesSuggestion>;
  sdkUrl?: string | null;
};

type ChangeSdkSuggestion = {
  type: 'changeSdk';
  newSdkName: string;
  enables: Array<SDKUpdatesSuggestion>;
  sdkUrl?: string | null;
};

export type SDKUpdatesSuggestion =
  | EnableIntegrationSuggestion
  | UpdateSdkSuggestion
  | ChangeSdkSuggestion;

export type ProjectSdkUpdates = {
  projectId: string;
  sdkName: string;
  sdkVersion: string;
  suggestions: SDKUpdatesSuggestion[];
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
 * Avatars are a more primitive version of User.
 */
export type AvatarUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  ip_address: string;
  avatarUrl?: string;
  avatar?: Avatar;
  // Compatibility shim with EventUser serializer
  ipAddress?: string;
  options?: {
    avatarType: Avatar['avatarType'];
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
  name: EnrolledAuthenticator['name'];
};

export type User = Omit<AvatarUser, 'options'> & {
  lastLogin: string;
  isSuperuser: boolean;
  isAuthenticated: boolean;
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
    theme: 'system' | 'light' | 'dark';
    timezone: string;
    stacktraceOrder: number;
    language: string;
    clock24Hours: boolean;
    avatarType: Avatar['avatarType'];
  };
  flags: {newsletter_consent_prompt: boolean};
  hasPasswordAuth: boolean;
  permissions: Set<string>;
  experiments: Partial<UserExperiments>;
};

// XXX(epurkhiser): we should understand how this is diff from User['emails]
// above
export type UserEmail = {
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
};

export type CommitAuthor = {
  email?: string;
  name?: string;
};

export type Environment = {
  id: string;
  displayName: string;
  name: string;

  // XXX: Provided by the backend but unused due to `getUrlRoutingName()`
  // urlRoutingName: string;
};

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
  assets: Array<{url: string}>;
  doc: string;
  features: string[];
  featureDescriptions: IntegrationFeature[];
  isHidden: boolean;
  version?: string;
  author?: {name: string; url: string};
  description?: string;
  resourceLinks?: Array<{title: string; url: string}>;
  altIsSentryApp?: boolean;
  deprecationDate?: string;
  firstPartyAlternative?: string;
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

export type IntegrationType = 'document' | 'plugin' | 'first_party' | 'sentry_app';

export type DocumentIntegration = {
  slug: string;
  name: string;
  author: string;
  docUrl: string;
  description: string;
  features: IntegrationFeature[];
  resourceLinks: Array<{title: string; url: string}>;
};

export type DateString = Date | string | null;
export type RelativePeriod = keyof typeof DEFAULT_RELATIVE_PERIODS;
export type IntervalPeriod = ReturnType<typeof getInterval>;

export type GlobalSelection = {
  // Project Ids currently selected
  projects: number[];
  environments: string[];
  datetime: {
    start: DateString;
    end: DateString;
    period: RelativePeriod | string;
    utc: boolean | null;
  };
};

export type AuthenticatorDevice = {
  key_handle: string;
  authId: string;
  name: string;
  timestamp?: string;
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
   * Allows authenticator's secret to be rotated without disabling
   */
  allowRotationInPlace: boolean;
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
   * Is this used as a backup interface?
   */
  isBackupInterface: boolean;
  /**
   * Description of the authenticator
   */
  description: string;
  rotationWarning: string | null;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  codes: string[];
  devices: AuthenticatorDevice[];
  phone?: string;
  secret?: string;
  /**
   * The form configuration for the authenticator is present during enrollment
   */
  form?: Field[];
} & Partial<EnrolledAuthenticator> &
  (
    | {
        id: 'sms';
      }
    | {
        id: 'totp';
        qrcode: string;
      }
    | {
        id: 'u2f';
        challenge: ChallengeData;
      }
  );

export type ChallengeData = {
  // will have only authenticateRequest or registerRequest
  authenticateRequests: u2f.SignRequest;
  registerRequests: u2f.RegisterRequest;
  registeredKeys: u2f.RegisteredKey[];
};

export type EnrolledAuthenticator = {
  lastUsedAt: string | null;
  createdAt: string;
  authId: string;
  name: string;
};

export interface Config {
  theme: 'light' | 'dark';
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

  /**
   * This comes from django (django.contrib.messages)
   */
  messages: {message: string; level: string}[];
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
  sentryConfig: {
    dsn: string;
    release: string;
    whitelistUrls: string[];
  };
  distPrefix: string;
  apmSampling: number;
  dsn_requests: string;
  demoMode: boolean;
  statuspage?: {
    id: string;
    api_host: string;
  };
}

// https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
// Note: the value of the enum on the frontend is plural,
// but the value of the enum on the backend is singular
export enum DataCategory {
  DEFAULT = 'default',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
}

export type EventType = 'error' | 'transaction' | 'attachment';

export const DataCategoryName = {
  [DataCategory.ERRORS]: 'Errors',
  [DataCategory.TRANSACTIONS]: 'Transactions',
  [DataCategory.ATTACHMENTS]: 'Attachments',
};

export enum EventOrGroupType {
  ERROR = 'error',
  CSP = 'csp',
  HPKP = 'hpkp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  DEFAULT = 'default',
  TRANSACTION = 'transaction',
}

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

type BaseRepositoryProjectPathConfig = {
  id: string;
  projectId: string;
  projectSlug: string;
  repoId: string;
  repoName: string;
  stackRoot: string;
  sourceRoot: string;
  defaultBranch?: string;
};

export type RepositoryProjectPathConfig = BaseRepositoryProjectPathConfig & {
  integrationId: string | null;
  provider: BaseIntegrationProvider | null;
};

export type RepositoryProjectPathConfigWithIntegration =
  BaseRepositoryProjectPathConfig & {
    integrationId: string;
    provider: BaseIntegrationProvider;
  };

export type PullRequest = {
  id: string;
  title: string;
  externalUrl: string;
  repository: Repository;
};

type IntegrationDialog = {
  actionText: string;
  body: string;
};

type IntegrationAspects = {
  alerts?: Array<React.ComponentProps<typeof Alert> & {text: string}>;
  disable_dialog?: IntegrationDialog;
  removal_dialog?: IntegrationDialog;
  externalInstall?: {
    url: string;
    buttonText: string;
    noticeText: string;
  };
  configure_integration?: {
    title: string;
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
  url: string;
  params?: Array<string>;
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
  // possible null params
  webhookUrl: string | null;
  redirectUrl: string | null;
  overview: string | null;
  // optional params below
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
  scopes?: string[];
  status: ObjectStatus;
  provider: BaseIntegrationProvider & {aspects: IntegrationAspects};
  dynamicDisplayInformation?: {
    configure_integration?: {
      instructions: string[];
    };
    integration_detail?: {
      uninstallationUrl?: string;
    };
  };
};

// we include the configOrganization when we need it
export type IntegrationWithConfig = Integration & {
  configOrganization: Field[];
  configData: object | null;
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
  issueId: string;
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

export type ServiceHook = {
  id: string;
  events: string[];
  dateCreated: string;
  secret: string;
  status: string;
  url: string;
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

// See src/sentry/api/serializers/models/apitoken.py for the differences based on application
type BaseApiToken = {
  id: string;
  scopes: Scope[];
  expiresAt: string;
  dateCreated: string;
  state: string;
};

// We include the token for API tokens used for internal apps
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

export type Release = BaseRelease &
  ReleaseData & {
    projects: ReleaseProject[];
  };

export type ReleaseWithHealth = BaseRelease &
  ReleaseData & {
    projects: Required<ReleaseProject>[];
  };

type ReleaseData = {
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
  versionInfo: VersionInfo;
  fileCount: number | null;
  currentProjectMeta: {
    nextReleaseVersion: string | null;
    prevReleaseVersion: string | null;
    sessionsLowerBound: string | null;
    sessionsUpperBound: string | null;
    firstReleaseVersion: string | null;
    lastReleaseVersion: string | null;
  };
  adoptionStages?: Record<
    'string',
    {
      stage: string | null;
      adopted: string | null;
      unadopted: string | null;
    }
  >;
};

type BaseRelease = {
  dateReleased: string;
  url: string;
  dateCreated: string;
  version: string;
  shortVersion: string;
  ref: string;
  status: ReleaseStatus;
};

export type CurrentRelease = {
  environment: string;
  firstSeen: string;
  lastSeen: string;
  release: Release;
  stats: {
    // 24h/30d is hardcoded in GroupReleaseWithStatsSerializer
    '24h': TimeseriesValue[];
    '30d': TimeseriesValue[];
  };
};
export enum ReleaseStatus {
  Active = 'open',
  Archived = 'archived',
}

export type ReleaseProject = {
  slug: string;
  name: string;
  id: number;
  platform: PlatformKey;
  platforms: PlatformKey[];
  newGroups: number;
  hasHealthData: boolean;
  healthData?: Health;
};

export type ReleaseMeta = {
  commitCount: number;
  commitFilesChanged: number;
  deployCount: number;
  releaseFileCount: number;
  version: string;
  projects: ReleaseProject[];
  versionInfo: VersionInfo;
  released: string;
};

export type VersionInfo = {
  buildHash: string | null;
  description: string;
  package: string | null;
  version: {raw: string};
};

export type Deploy = {
  id: string;
  name: string;
  url: string;
  environment: string;
  dateStarted: string;
  dateFinished: string;
  version: string;
};

export type Commit = {
  id: string;
  message: string | null;
  dateCreated: string;
  releases: BaseRelease[];
  repository?: Repository;
  author?: User;
};

export type Committer = {
  author: User;
  commits: Commit[];
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
  schema: SentryAppSchemaStacktraceLink;
  sentryApp: {
    uuid: string;
    slug:
      | 'calixa'
      | 'clickup'
      | 'komodor'
      | 'linear'
      | 'rookout'
      | 'shortcut'
      | 'spikesh'
      | 'taskcall'
      | 'teamwork';
    name: string;
  };
};

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

/**
 * The option format used by react-select based components
 */
export type SelectValue<T> = {
  label: string | number | React.ReactElement;
  value: T;
  disabled?: boolean;
  tooltip?: string;
};

/**
 * The 'other' option format used by checkboxes, radios and more.
 */
export type Choices = [
  value: string | number,
  label: string | number | React.ReactElement
][];

/**
 * The issue config form fields we get are basically the form fields we use in
 * the UI but with some extra information. Some fields marked optional in the
 * form field are guaranteed to exist so we can mark them as required here
 */
export type IssueConfigField = Field & {
  name: string;
  default?: string | number;
  choices?: Choices;
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
  FIRST_TRANSACTION = 'setup_transactions',
}

export type OnboardingSupplementComponentProps = {
  task: OnboardingTask;
  onCompleteTask: () => void;
};

export type OnboardingTaskDescriptor = {
  task: OnboardingTaskKey;
  title: string;
  description: string;
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

export type Level = 'error' | 'fatal' | 'info' | 'warning' | 'sample';

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

export type SubscriptionDetails = {disabled?: boolean; reason?: string};

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

export type PlatformIntegration = {
  id: string;
  type: string;
  language: string;
  link: string | null;
  name: string;
};

export type EventGroupComponent = {
  contributes: boolean;
  hint: string | null;
  id: string;
  name: string | null;
  values: EventGroupComponent[] | string[];
};
export type EventGroupingConfig = {
  base: string | null;
  changelog: string;
  delegates: string[];
  hidden: boolean;
  id: string;
  latest: boolean;
  risk: number;
  strategies: string[];
};

type EventGroupVariantKey = 'custom-fingerprint' | 'app' | 'default' | 'system';

export enum EventGroupVariantType {
  CUSTOM_FINGERPRINT = 'custom-fingerprint',
  COMPONENT = 'component',
  SALTED_COMPONENT = 'salted-component',
}

export type EventGroupVariant = {
  description: string | null;
  hash: string | null;
  hashMismatch: boolean;
  key: EventGroupVariantKey;
  type: EventGroupVariantType;
  values?: Array<string>;
  client_values?: Array<string>;
  matched_rule?: string;
  component?: EventGroupComponent;
  config?: EventGroupingConfig;
};

export type SourceMapsArchive = {
  id: number;
  type: 'release';
  name: string;
  date: string;
  fileCount: number;
};

export type Artifact = {
  dateCreated: string;
  dist: string | null;
  id: string;
  name: string;
  sha1: string;
  size: number;
  headers: {'Content-Type': string};
};

export type EventGroupInfo = Record<EventGroupVariantKey, EventGroupVariant>;

// TODO(epurkhiser): objc and cocoa should almost definitely be moved into PlatformKey
export type PlatformType = PlatformKey | 'objc' | 'cocoa';

export type Frame = {
  absPath: string | null;
  colNo: number | null;
  context: Array<[number, string]>;
  errors: Array<any> | null;
  filename: string | null;
  function: string | null;
  inApp: boolean;
  instructionAddr: string | null;
  lineNo: number | null;
  module: string | null;
  package: string | null;
  platform: PlatformType | null;
  rawFunction: string | null;
  symbol: string | null;
  symbolAddr: string | null;
  trust: any | null;
  vars: Record<string, any> | null;
  symbolicatorStatus?: SymbolicatorStatus;
  addrMode?: string;
  origAbsPath?: string | null;
  mapUrl?: string | null;
  map?: string | null;
  isSentinel?: boolean;
  isPrefix?: boolean;
  minGroupingLevel?: number;
};

export enum FrameBadge {
  SENTINEL = 'sentinel',
  PREFIX = 'prefix',
  GROUPING = 'grouping',
}

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

export type FilesByRepository = {
  [repoName: string]: {
    authors?: {[email: string]: CommitAuthor};
    types?: Set<string>;
  };
};

export type ExceptionValue = {
  type: string;
  value: string;
  threadId: number | null;
  stacktrace: StacktraceType | null;
  rawStacktrace: RawStacktrace;
  mechanism: StackTraceMechanism | null;
  module: string | null;
  frames: Frame[] | null;
};

export type ExceptionType = {
  excOmitted: any | null;
  hasSystemFrames: boolean;
  values?: Array<ExceptionValue>;
};

/**
 * Identity is used in Account Identities for SocialAuths
 */
export type Identity = {
  id: string;
  provider: IntegrationProvider;
  providerLabel: string;
};

// taken from https://stackoverflow.com/questions/46634876/how-can-i-change-a-readonly-property-in-typescript
export type Writable<T> = {-readonly [K in keyof T]: T[K]};

export type InternetProtocol = {
  id: string;
  ipAddress: string;
  lastSeen: string;
  firstSeen: string;
  countryCode: string | null;
  regionCode: string | null;
};

/**
 * XXX(ts): This actually all comes from getsentry. We should definitely
 * refactor this into a more proper 'hook' mechanism in the future
 */
export type AuthConfig = {
  canRegister: boolean;
  serverHostname: string;
  hasNewsletter: boolean;
  githubLoginLink: string;
  vstsLoginLink: string;
  googleLoginLink: string;
};

export type AuthProvider = {
  key: string;
  name: string;
  requiredFeature: string;
  disables2FA: boolean;
};

export type PromptActivity = {
  snoozedTime?: number;
  dismissedTime?: number;
};

export type ServerlessFunction = {
  name: string;
  runtime: string;
  version: number;
  outOfDate: boolean;
  enabled: boolean;
};

/**
 * Base type for series   style API response
 */
export type SeriesApi = {
  intervals: string[];
  groups: {
    by: Record<string, string | number>;
    totals: Record<string, number>;
    series: Record<string, number[]>;
  }[];
};

export type SessionApiResponse = SeriesApi & {
  start: DateString;
  end: DateString;
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

export enum ReleaseComparisonChartType {
  CRASH_FREE_USERS = 'crashFreeUsers',
  HEALTHY_USERS = 'healthyUsers',
  ABNORMAL_USERS = 'abnormalUsers',
  ERRORED_USERS = 'erroredUsers',
  CRASHED_USERS = 'crashedUsers',
  CRASH_FREE_SESSIONS = 'crashFreeSessions',
  HEALTHY_SESSIONS = 'healthySessions',
  ABNORMAL_SESSIONS = 'abnormalSessions',
  ERRORED_SESSIONS = 'erroredSessions',
  CRASHED_SESSIONS = 'crashedSessions',
  SESSION_COUNT = 'sessionCount',
  USER_COUNT = 'userCount',
  ERROR_COUNT = 'errorCount',
  TRANSACTION_COUNT = 'transactionCount',
  FAILURE_RATE = 'failureRate',
  SESSION_DURATION = 'sessionDuration',
}

export enum HealthStatsPeriodOption {
  AUTO = 'auto',
  TWENTY_FOUR_HOURS = '24h',
}

export type IssueOwnership = {
  raw: string;
  fallthrough: boolean;
  dateCreated: string;
  lastUpdated: string;
  isActive: boolean;
  autoAssignment: boolean;
};

export type CodeOwner = {
  id: string;
  raw: string;
  dateCreated: string;
  dateUpdated: string;
  provider: 'github' | 'gitlab';
  codeMapping?: RepositoryProjectPathConfig;
  codeMappingId: string;
  ownershipSyntax?: string;
  errors: {
    missing_external_teams: string[];
    missing_external_users: string[];
    missing_user_emails: string[];
    teams_without_access: string[];
    users_without_access: string[];
  };
};

export type KeyValueListData = {
  key: string;
  subject: string;
  value?: React.ReactNode;
  meta?: Meta;
  subjectDataTestId?: string;
  subjectIcon?: React.ReactNode;
}[];

export type ExternalActorMapping = {
  id: string;
  externalName: string;
  userId?: string;
  teamId?: string;
  sentryName: string;
};

export type ExternalUser = {
  id: string;
  memberId: string;
  externalName: string;
  provider: string;
  integrationId: string;
};

export type ExternalTeam = {
  id: string;
  teamId: string;
  externalName: string;
  provider: string;
  integrationId: string;
};

export type CodeownersFile = {
  raw: string;
  filepath: string;
  html_url: string;
};

// Response from ShortIdLookupEndpoint
// /organizations/${orgId}/shortids/${query}/
export type ShortIdResponse = {
  organizationSlug: string;
  projectSlug: string;
  groupId: string;
  group: Group;
  shortId: string;
};

// Response from EventIdLookupEndpoint
// /organizations/${orgSlug}/eventids/${eventId}/
export type EventIdResponse = {
  organizationSlug: string;
  projectSlug: string;
  groupId: string;
  eventId: string;
  event: Event;
};
