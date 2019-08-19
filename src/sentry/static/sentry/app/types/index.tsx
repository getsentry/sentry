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

// This type is incomplete
export type Event = {
  id: string;
  eventID: string;
  groupID?: string;
  type: string;
  title: string;
  culprit: string;
  metadata: EventMetadata;
  message: string;
  platform?: string;
};

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
