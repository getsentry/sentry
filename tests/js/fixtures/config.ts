import {UserFixture} from 'sentry-fixture/user';

import type {Config} from 'sentry/types/system';

export function ConfigFixture(params: Partial<Config> = {}): Config {
  return {
    theme: 'light',
    user: params.user || UserFixture(),
    messages: [],
    languageCode: 'en',
    csrfCookieName: 'csrf-test-cookie',
    superUserCookieName: 'su-test-cookie',
    superUserCookieDomain: '.sentry.io',
    validateSUForm: true,
    features: new Set(),
    shouldPreloadData: true,
    singleOrganization: false,
    enableAnalytics: true,
    urlPrefix: 'https://sentry-jest-tests.example.com/',
    needsUpgrade: false,
    supportEmail: 'support@sentry.io',
    invitesEnabled: false,
    privacyUrl: null,
    termsUrl: null,
    // Maintain isOnPremise key for backcompat (plugins?).
    isOnPremise: false,
    isSelfHosted: false,
    isSelfHostedErrorsOnly: false,
    sentryMode: 'SAAS',
    lastOrganization: null,
    gravatarBaseUrl: 'https://gravatar.com',
    initialTrace: {
      baggage: 'baggage',
      sentry_trace: 'sentry_trace',
    },
    dsn: 'test-dsn',
    userIdentity: {
      ip_address: '127.0.0.1',
      email: 'example@example.com',
      id: '1',
      isStaff: false,
    },
    isAuthenticated: true,
    version: {
      current: '1.0.0-dev',
      latest: '1.0.0-dev',
      build: 'test-build',
      upgradeAvailable: false,
    },
    sentryConfig: {
      dsn: 'test-dsn',
      release: '1.0.0.-dev',
      allowUrls: [],
      tracePropagationTargets: [],
    },
    distPrefix: '',
    disableU2FForSUForm: false,
    apmSampling: 1,
    demoMode: false,
    customerDomain: null,
    links: {
      sentryUrl: "https://sentry.io",
      organizationUrl: undefined,
      regionUrl: undefined,
    },
    memberRegions: [{name: 'us', url: 'https://sentry.io'}],
    regions: [{name: 'us', url: 'https://sentry.io'}],
    ...params,
  };
}
