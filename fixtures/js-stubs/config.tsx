import {User} from 'sentry-fixture/user';

import {Config as ConfigType} from 'sentry/types';

export function Config(params: Partial<ConfigType> = {}): ConfigType {
  return {
    theme: 'light',
    user: User(),
    messages: [],
    languageCode: 'en',
    csrfCookieName: 'csrf-test-cookie',
    superUserCookieName: 'su-test-cookie',
    superUserCookieDomain: '.sentry.io',
    validateSUForm: true,
    features: new Set(),
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
    customerDomain: {
      subdomain: 'foobar',
      organizationUrl: 'https://foobar.sentry.io',
      sentryUrl: 'https://sentry.io',
    },
    links: {
      sentryUrl: 'https://sentry.io',
      organizationUrl: 'https://foobar.sentry.io',
      regionUrl: 'https://us.sentry.io',
    },
    regions: [{name: 'us', url: 'https://sentry.io'}],
    ...params,
  };
}
