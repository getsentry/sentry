import {SpanEntry} from 'app/components/events/interfaces/spans/types';

export type Organization = {
  id: string;
  slug: string;
  projects: Project[];
  access: string[];
  features: string[];
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
};

export type Project = {
  id: string;
  slug: string;
  isMember: boolean;
  teams: Team[];
  features: string[];

  isBookmarked: boolean;
};

export type Team = {
  id: string;
  slug: string;
  isMember: boolean;
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

type SentryEventBase = {
  id: string;
  eventID: string;
  groupID?: string;
  title: string;
  culprit: string;
  metadata: EventMetadata;
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

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type CommitAuthor = {
  email?: string;
  name?: string;
};

// TODO(ts): This type is incomplete
export type Environment = {};

// TODO(ts): This type is incomplete
export type SavedSearch = {};

// TODO(ts): This type is incomplete
export type Plugin = {};

export type GlobalSelection = {
  projects: number[];
  environments: string[];
  datetime: {
    start: string;
    end: string;
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
  features: string[];
  singleOrganization: boolean;
  urlPrefix: string;
  needsUpgrade: boolean;
  supportEmail: string;
  user: {
    username: string;
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
    id: string;
    isActive: boolean;
    has2fa: boolean;
    canReset2fa: boolean;
    name: string;
    avatarUrl: string;
    authenticators: Authenticator[];
    dateJoined: string;
    options: {
      timezone: string;
      stacktraceOrder: number;
      language: string;
      clock24Hours: boolean;
    };
    flags: {newsletter_consent_prompt: boolean};
    avatar: {avatarUuid: string | null; avatarType: 'letter_avatar' | 'upload'};
    hasPasswordAuth: boolean;
    permissions: string[];
    email: string;
  };

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

export type EventViewv1 = {
  name: string;
  data: {
    fields: string[];
    columnNames: string[];
    sort: string[];
    query?: string;
  };
  tags: string[];
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

export enum WebhookEvents {
  issue = 'issue',
  error = 'error',
}

export type SentryApp = {
  status: string;
  scopes: string[];
  isAlertable: boolean;
  verifyInstall: boolean;
  slug: string;
  name: string;
  uuid: string;
  author: string;
  events: WebhookEvents[];
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
