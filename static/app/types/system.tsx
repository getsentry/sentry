import {FocusTrap} from 'focus-trap';

import exportGlobals from 'sentry/bootstrap/exportGlobals';

import {User} from './user';

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
  // Maintain isOnPremise key for backcompat (plugins?).
  isOnPremise: boolean;
  isSelfHosted: boolean;
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

export type PipelineInitialData = {
  name: string;
  props: Record<string, any>;
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

export type PromptActivity = {
  snoozedTime?: number;
  dismissedTime?: number;
};
