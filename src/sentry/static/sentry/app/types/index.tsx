import {SpanEntry} from 'app/views/organizationEventsV2/transactionView/types';

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
  annotations: string[];
  assignedTo: User;
  count: string;
  culprit: string;
  firstSeen: string;
  hasSeen: boolean;
  isBookmarked: boolean;
  isPublic: boolean;
  isSubscribed: boolean;
  lastSeen: string;
  level: string;
  logger: string;
  metadata: Metadata;
  numComments: number;
  permalink: string;
  project: {
    name: string;
    slug: string;
  };
  shareId: string;
  shortId: string;
  status: string;
  statusDetails: {};
  title: string;
  type: EventOrGroupType;
  userCount: number;
  seenBy: User[];
};

export type EventView = {
  id: string;
  name: string;
  data: {
    fields: string[];
    columnNames: string[];
    sort: string[];
    query?: string;

    // TODO: removed as of https://github.com/getsentry/sentry/pull/14321
    // groupby: string[];
    // orderby: string[];
  };
  tags: string[];
  columnWidths: string[];
};
