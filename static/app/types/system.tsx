import type {Theme} from '@emotion/react';
import type {FocusTrap} from 'focus-trap';

import type {ApiResult} from 'sentry/api';
import type {exportedGlobals} from 'sentry/bootstrap/exportGlobals';

import type {ParntershipAgreementType} from './hooks';
import type {User} from './user';

export enum SentryInitRenderReactComponent {
  INDICATORS = 'Indicators',
  SETUP_WIZARD = 'SetupWizard',
  SYSTEM_ALERTS = 'SystemAlerts',
  U2F_SIGN = 'U2fSign',
  SU_STAFF_ACCESS_FORM = 'SuperuserStaffAccessForm',
}

export type OnSentryInitConfiguration =
  | {
      element: string;
      input: string;
      name: 'passwordStrength';
    }
  | {
      component: SentryInitRenderReactComponent;
      container: string;
      name: 'renderReact';
      props?: Record<string, any>;
    }
  | {
      name: 'onReady';
      onReady: (globals: typeof exportedGlobals) => void;
    };

declare global {
  interface Window {
    /**
     * Primary entrypoint for rendering the sentry app. This is typically
     * called in the django templates, or in the case of the EXPERIMENTAL_SPA,
     * after config hydration.
     */
    SentryRenderApp: () => void;
    /**
     * Used to close tooltips for testing purposes.
     */
    __closeAllTooltips: () => void;

    /**
     * The config object provided by the backend.
     */
    __initialData: Config;

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
     * Used to open tooltips for testing purposes.
     */
    __openAllTooltips: () => void;
    /**
     * Pipeline
     */
    __pipelineInitialData: PipelineInitialData;
    /**
     * Assets public location
     */
    __sentryGlobalStaticPrefix: string;
    /**
     * Is populated with promises/strings of commonly used data.
     */
    __sentry_preload: {
      orgSlug?: string;
      organization?: Promise<ApiResult>;
      organization_fallback?: Promise<ApiResult>;
      projects?: Promise<ApiResult>;
      projects_fallback?: Promise<ApiResult>;
      teams?: Promise<ApiResult>;
      teams_fallback?: Promise<ApiResult>;
    };

    // typing currently used for demo add on
    // TODO: improve typing
    SentryApp?: {
      ConfigStore: any;
      HookStore: any;
      Modal: any;
      getModalPortal: () => HTMLElement;
      modalFocusTrap?: {
        current?: FocusTrap;
      };
    };
    /**
     * Is the UI running as dev-ui proxy.
     * Used by webpack-devserver + html-webpack
     */
    __SENTRY_DEV_UI?: boolean;
    /**
     * Sentrys version string
     */
    __SENTRY__VERSION?: string;
    /**
     * Set to true if adblock could be installed.
     * See sentry/js/ads.js for how this global is disabled.
     */
    adblockSuspected?: boolean;
    /**
     * The CSRF cookie used on the backend
     */
    csrfCookieName?: string;
    sentryEmbedCallback?: ((embed: any) => void) | null;
    /**
     * The domain of which the superuser cookie is set onto.
     */
    superUserCookieDomain?: string;
    /**
     * The superuser cookie used on the backend
     */
    superUserCookieName?: string;
  }
}

export interface Region {
  name: string;
  url: string;
}
interface CustomerDomain {
  organizationUrl: string | undefined;
  sentryUrl: string;
  subdomain: string;
}
export interface Config {
  apmSampling: number;
  csrfCookieName: string;
  customerDomain: CustomerDomain | null;
  demoMode: boolean;
  disableU2FForSUForm: boolean;
  distPrefix: string;
  dsn: string;
  enableAnalytics: boolean;
  features: Set<string>;
  gravatarBaseUrl: string;
  initialTrace: {
    baggage: string;
    sentry_trace: string;
  };
  invitesEnabled: boolean;
  isAuthenticated: boolean;

  // Maintain isOnPremise key for backcompat (plugins?).
  isOnPremise: boolean;
  isSelfHosted: boolean;
  isSelfHostedErrorsOnly: boolean;
  languageCode: string;
  lastOrganization: string | null;
  links: {
    organizationUrl: string | undefined;
    regionUrl: string | undefined;
    sentryUrl: string;
    superuserUrl?: string;
  };
  // A list of regions that the user has membership in.
  memberRegions: Region[];
  /**
   * This comes from django (django.contrib.messages)
   */
  messages: {level: keyof Theme['alert']; message: string}[];
  needsUpgrade: boolean;
  privacyUrl: string | null;
  // The list of regions the user has has access to.
  regions: Region[];
  sentryConfig: {
    allowUrls: string[];
    dsn: string;
    release: string;
    tracePropagationTargets: string[];
    environment?: string;
    profilesSampleRate?: number;
  };
  // sentryMode intends to supersede isSelfHosted,
  // so we can differentiate between "SELF_HOSTED", "SINGLE_TENANT", and "SAAS".
  sentryMode: 'SELF_HOSTED' | 'SINGLE_TENANT' | 'SAAS';
  shouldPreloadData: boolean;
  singleOrganization: boolean;
  superUserCookieDomain: string | null;
  superUserCookieName: string;
  supportEmail: string;
  termsUrl: string | null;
  theme: 'light' | 'dark';
  urlPrefix: string;
  /**
   * The user should not be accessible directly except during
   * app initialization. Use `useUser` or ConfigStore instead.
   * @deprecated
   */
  user: User;
  userIdentity: {
    email: string;
    id: string;
    ip_address: string;
    isStaff: boolean;
  };
  validateSUForm: boolean;
  version: {
    build: string;
    current: string;
    latest: string;
    upgradeAvailable: boolean;
  };
  partnershipAgreementPrompt?: {
    agreements: Array<ParntershipAgreementType>;
    partnerDisplayName: string;
  } | null;
  relocationConfig?: {
    selectableRegions: string[];
  };
  shouldShowBeaconConsentPrompt?: boolean;
  statuspage?: {
    api_host: string;
    id: string;
  };
}

export type PipelineInitialData = {
  name: string;
  props: Record<string, any>;
};

export interface Broadcast {
  dateCreated: string;
  dateExpires: string;
  /**
   * Has the item been seen? affects the styling of the panel item
   */
  hasSeen: boolean;
  id: string;
  isActive: boolean;
  /**
   * The URL to use for the CTA
   */
  link: string;
  /**
   * A message with muted styling which appears above the children content
   */
  message: string;
  title: string;
  /**
   * Category of the broadcast.
   * Synced with https://github.com/getsentry/sentry/blob/master/src/sentry/models/broadcast.py#L14
   */
  category?: 'announcement' | 'feature' | 'blog' | 'event' | 'video';
  /**
   * The text for the CTA link at the bottom of the panel item
   */
  cta?: string;
  /**
   * Image url
   */
  mediaUrl?: string;
  /**
   * Region of the broadcast. If not set, the broadcast will be shown for all regions.
   */
  region?: string;
}

// XXX(epurkhiser): The components list can be generated using jq
//
// curl -s https://status.sentry.io/api/v2/components.json \
// | jq -r '
//   .components
//   | map({key: (.name | gsub( "[^a-zA-Z]"; "_") | ascii_upcase ), value:.id})
//   | map("\(.key) = \"\(.value)\",")
//   | .[]'
// | sort

/**
 * Mapping of components to IDs
 *
 * Should be kept in sync with https://status.sentry.io/api/v2/components.json
 */
export const enum StatusPageComponent {
  ALERTING = 'sykq5vtjw8zx',
  API = 'qywmfv7jr0pd',
  AUTHENTICATION_SERVICES = 'f5rs5z9q0dtk',
  AZURE_DEVOPS = 'tn9py6p7f85x',
  DASHBOARD = 'khtl9dcky3lb',
  ELECTRON_SYMBOL_SERVER = '3jzzl28504tq',
  EMAIL = 'tjmyq3lb26w0',
  EU_ATTACHMENT_INGESTION = 'ztwsc8ff50v9',
  EU_CRON_MONITORING = 'qnj485gffb6v',
  EU_ERRORS = 'yqdr3zmyjv12',
  EU_ERROR_INGESTION = '1yf02ms0qsl7',
  EU_INGESTION = 'xmpnd79f7t51',
  EU_PROFILE_INGESTION = 'xbljnbzl9c77',
  EU_REPLAY_INGESTION = '3zhbl35gmbp0',
  EU_SPAN_INGESTION = '7rv05jl5qp0w',
  EU_TRANSACTION_INGESTION = 'tlkrt7x46b52',
  GITHUB = 'lqps2hvc2400',
  GOOGLE = 'bprcc4mhbhmm',
  HEROKU = '6g5bq169xp2s',
  INTEGRATION_PIPELINE = '6gtdt9t60dl0',
  MICROSOFT_SYMBOL_SERVER = '216356jwwrxq',
  MICROSOFT_TEAMS = 'z57k9q3r5jsh',
  NOTIFICATION_DELIVERY = 'rmq51qyvxfjh',
  PAGERDUTY = 'jd3tvjnx5l1f',
  PASSWORD_BASED = 'ml2wmx3hzlnn',
  SAML_BASED_SINGLE_SIGN_ON = 'hsbnk3hxcckr',
  SLACK = 'jkpcsxvvv2hf',
  STRIPE = '87stwrsyk6ls',
  THIRD_PARTY_INTEGRATIONS = 'yhfrrcmppvgh',
  US_ATTACHMENT_INGESTION = 'cycj4r32g25w',
  US_CRON_MONITORING = '6f1r28lydc6h',
  US_ERRORS = 'bctv81yt9s6w',
  US_ERROR_INGESTION = '51yszynm4xyv',
  US_INGESTION = '76x1wwzzfj5c',
  US_PROFILE_INGESTION = '52t4t3ww2qcn',
  US_REPLAY_INGESTION = 'zxkxxtspk64g',
  US_SPAN_INGESTION = 'qd7tzrk5q8xm',
  US_TRANSACTION_INGESTION = 'bdg4djkxjxmk',
}

export type StatusPageServiceStatus =
  | 'operational'
  | 'degraded_performance'
  | 'major_outage'
  | 'partial_outage';

export interface StatusPageIncidentComponent {
  /**
   * ISO 8601 component creation time
   */
  created_at: string;
  description: string;
  group: boolean;
  group_id: string;
  id: StatusPageComponent;
  name: string;
  only_show_if_degraded: boolean;
  page_id: string;
  position: number;
  showcase: boolean;
  /**
   * Date of the component becoming active
   */
  start_date: string;
  status: StatusPageServiceStatus;
  /**
   * ISO 8601 component update time
   */
  updated_at: string;
}

export interface StatusPageAffectedComponent {
  code: StatusPageComponent;
  name: string;
  new_status: StatusPageServiceStatus;
  old_status: StatusPageServiceStatus;
}

export interface StatusPageIncidentUpdate {
  /**
   * Components affected by the update
   */
  affected_components: StatusPageAffectedComponent[];
  /**
   * Message to display for this update
   */
  body: string;
  /**
   * ISO Update creation time
   */
  created_at: string;
  /**
   * ISO Update display time
   */
  display_at: string;
  /**
   * Unique ID of the incident
   */
  id: string;
  /**
   * Unique ID of the incident
   */
  incident_id: string;
  /**
   * Status of the incident for tihs update
   */
  status: 'resolved' | 'monitoring' | 'identified' | 'investigating';
  /**
   * ISO Update update time
   */
  updated_at: string;
}

// See: https://doers.statuspage.io/api/v2/incidents/
export interface StatuspageIncident {
  /**
   * Components related to this incident
   */
  components: StatusPageIncidentComponent[];
  /**
   * ISO 8601 created time
   */
  created_at: string;
  /**
   * Unique ID of the incident
   */
  id: string;
  /**
   * The impact of the incident
   */
  impact: 'none' | 'minor' | 'major';
  /**
   * Updates for this incident
   */
  incident_updates: StatusPageIncidentUpdate[];
  /**
   * ISO 8601 time monitoring began
   */
  monitoring_at: string | undefined;
  /**
   * Name of the incident
   */
  name: string;
  /**
   * The status page page ID
   */
  page_id: string;
  /**
   * ISO 8601 last updated time
   */
  resolved_at: string | undefined;
  /**
   * Short URL of the incident
   */
  shortlink: string;
  /**
   * ISO 8601 incident start time
   */
  started_at: string | undefined;
  /**
   * Current status of the incident
   */
  status: 'resolved' | 'unresolved' | 'monitoring';
  /**
   * ISO 8601 last updated time
   */
  updated_at: string | undefined;
}

export type PromptActivity = {
  dismissedTime?: number;
  snoozedTime?: number;
};
