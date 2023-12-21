import {Theme} from '@emotion/react';
import type {FocusTrap} from 'focus-trap';

import type {exportedGlobals} from 'sentry/bootstrap/exportGlobals';

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
    __sentry_preload: Record<string, any>;

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
  languageCode: string;
  lastOrganization: string | null;
  links: {
    organizationUrl: string | undefined;
    regionUrl: string | undefined;
    sentryUrl: string;
    superuserUrl?: string;
  };
  /**
   * This comes from django (django.contrib.messages)
   */
  messages: {level: keyof Theme['alert']; message: string}[];
  needsUpgrade: boolean;
  privacyUrl: string | null;
  // The list of regions the current user has memberships in.
  regions: Region[];
  sentryConfig: {
    allowUrls: string[];
    dsn: string;
    release: string;
    tracePropagationTargets: string[];
    environment?: string;
    profilesSampleRate?: number;
  };
  singleOrganization: boolean;
  superUserCookieDomain: string | null;
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
