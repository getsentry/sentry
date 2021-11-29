// XXX(epurkhiser): When we switch to the new React JSX runtime we will no
// longer need this import and can drop babel-preset-css-prop for babel-preset.
/// <reference types="@emotion/react/types/css-prop" />

import {FocusTrap} from 'focus-trap';

import exportGlobals from 'sentry/bootstrap/exportGlobals';
import {getInterval} from 'sentry/components/charts/utils';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';

import {DateString, Scope} from './core';
import {Member, Organization, Team} from './organization';
import {User} from './user';

export * from './auth';
export * from './core';
export * from './event';
export * from './group';
export * from './integrations';
export * from './onboarding';
export * from './organization';
export * from './project';
export * from './relay';
export * from './release';
export * from './stacktrace';
export * from './user';
export * from './metrics';

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
    /**
     * This is used for testing purposes as an interem while we translate tests
     * to React Testing Library.
     *
     * See the useLegacyStore hook for more unformation about this.
     */
    _legacyStoreHookUpdate: (update: () => void) => void;

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
  termsUrl: string | null;
  isOnPremise: boolean;
  lastOrganization: string | null;
  gravatarBaseUrl: string;

  /**
   * This comes from django (django.contrib.messages)
   */
  messages: {message: string; level: string}[];
  dsn: string;
  userIdentity: {
    ip_address: string;
    email: string;
    id: string;
    isStaff: boolean;
  };
  isAuthenticated: boolean;
  version: {
    current: string;
    latest: string;
    build: string;
    upgradeAvailable: boolean;
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

export enum UserIdentityCategory {
  SOCIAL_IDENTITY = 'social-identity',
  GLOBAL_IDENTITY = 'global-identity',
  ORG_IDENTITY = 'org-identity',
}

export enum UserIdentityStatus {
  CAN_DISCONNECT = 'can_disconnect',
  NEEDED_FOR_GLOBAL_AUTH = 'needed_for_global_auth',
  NEEDED_FOR_ORG_AUTH = 'needed_for_org_auth',
}

export type UserIdentityProvider = {
  key: string;
  name: string;
};

/**
 * UserIdentityConfig is used in Account Identities
 */
export type UserIdentityConfig = {
  category: UserIdentityCategory;
  id: string;
  provider: UserIdentityProvider;
  status: UserIdentityStatus;
  isLogin: boolean;
  organization: Organization | null;
  dateAdded: DateString;
};

export type InternetProtocol = {
  id: string;
  ipAddress: string;
  lastSeen: string;
  firstSeen: string;
  countryCode: string | null;
  regionCode: string | null;
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
 * Base type for series style API response
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
