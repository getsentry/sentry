import type {FocusTrap} from 'focus-trap';

import type exportGlobals from 'sentry/bootstrap/exportGlobals';
import {Theme} from 'sentry/utils/theme';

import type {User} from './user';

export enum SentryInitRenderReactComponent {
  INDICATORS = 'Indicators',
  SETUP_WIZARD = 'SetupWizard',
  SYSTEM_ALERTS = 'SystemAlerts',
  U2F_SIGN = 'U2fSign',
  SU_ACCESS_FORM = 'SuperuserAccessForm',
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
      onReady: (globals: typeof exportGlobals) => void;
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
     * This is used for testing purposes as an interem while we translate tests
     * to React Testing Library.
     *
     * See the useLegacyStore hook for more unformation about this.
     */
    _legacyStoreHookUpdate: (update: () => void) => void;
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
     * The superuser cookie used on the backend
     */
    superUserCookieName?: string;
  }
}

export interface Config {
  apmSampling: number;
  csrfCookieName: string;
  demoMode: boolean;
  disableU2FForSUForm: boolean;
  distPrefix: string;
  dsn: string;
  enableAnalytics: boolean;
  features: Set<string>;
  gravatarBaseUrl: string;
  invitesEnabled: boolean;
  isAuthenticated: boolean;

  // Maintain isOnPremise key for backcompat (plugins?).
  isOnPremise: boolean;
  isSelfHosted: boolean;
  languageCode: string;
  lastOrganization: string | null;
  links: {
    organizationUrl: string | undefined;
    regionUrl: string | undefined;
    sentryUrl: string;
  };
  /**
   * This comes from django (django.contrib.messages)
   */
  messages: {level: keyof Theme['alert']; message: string}[];
  needsUpgrade: boolean;
  privacyUrl: string | null;

  sentryConfig: {
    dsn: string;
    release: string;
    whitelistUrls: string[];
  };
  singleOrganization: boolean;
  superUserCookieName: string;
  supportEmail: string;
  termsUrl: string | null;
  theme: 'light' | 'dark';
  urlPrefix: string;
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
  statuspage?: {
    api_host: string;
    id: string;
  };
}

export type PipelineInitialData = {
  name: string;
  props: Record<string, any>;
};

export type Broadcast = {
  cta: string;
  dateCreated: string;
  dateExpires: string;
  hasSeen: boolean;
  id: string;
  isActive: boolean;
  link: string;
  message: string;
  title: string;
};

export type SentryServiceIncident = {
  affectedComponents: Array<{
    name: string;
    status: 'degraded_performance' | 'partial_outage' | 'major_outage' | 'operational';
    updatedAt: string;
  }>;
  createdAt: string;
  id: string;
  name: string;
  status: string;
  updates: Array<{
    body: string;
    status: string;
    updatedAt: string;
  }>;
  url: string;
};

export type SentryServiceStatus = {
  incidents: SentryServiceIncident[];
  indicator: 'major' | 'minor' | 'none';
  url: string;
};

export type PromptActivity = {
  dismissedTime?: number;
  snoozedTime?: number;
};
