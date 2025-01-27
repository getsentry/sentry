import {LocationFixture} from 'sentry-fixture/locationFixture';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

describe('normalizeUrl', function () {
  let configState: Config;
  let result: any;

  beforeEach(function () {
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(function () {
    ConfigStore.loadInitialData(configState);
  });

  it('replaces paths in strings', function () {
    const location = LocationFixture();
    const cases = [
      // input, expected
      ['/settings/', '/settings/'],
      ['/accept-terms/acme/', '/accept-terms/'],

      // Organization settings views.
      ['/settings/acme/', '/settings/organization/'],
      ['/settings/organization', '/settings/organization/'],
      ['/settings/sentry-organizations/members/', '/settings/members/'],
      ['/settings/sentry-organizations/members/3/', '/settings/members/3/'],
      ['/settings/sentry-organizations/teams/peeps/', '/settings/teams/peeps/'],
      ['/settings/sentry-organizations/teams/payments/', '/settings/teams/payments/'],
      ['/settings/sentry-organizations/billing/receipts/', '/settings/billing/receipts/'],
      [
        '/settings/sentry-organizations/teams/test-organizations/notifications/',
        '/settings/teams/test-organizations/notifications/',
      ],
      [
        '/settings/acme/developer-settings/release-bot/',
        '/settings/developer-settings/release-bot/',
      ],
      [
        '/settings/sentry-organizations/integrations/vercel/12345/?next=something',
        '/settings/integrations/vercel/12345/?next=something',
      ],
      // Settings views for orgs with acccount/billing in their slugs.
      ['/settings/account-on/', '/settings/organization/'],
      ['/settings/billing-co/', '/settings/organization/'],
      ['/settings/account-on/integrations/', '/settings/integrations/'],
      [
        '/settings/account-on/projects/billing-app/source-maps/',
        '/settings/projects/billing-app/source-maps/',
      ],
      ['/settings/billing-co/integrations/', '/settings/integrations/'],
      [
        '/settings/billing-co/projects/billing-app/source-maps/',
        '/settings/projects/billing-app/source-maps/',
      ],
      // Account settings should stay the same
      ['/settings/account/', '/settings/account/'],
      ['/settings/account/security/', '/settings/account/security/'],
      ['/settings/account/details/', '/settings/account/details/'],

      ['/join-request/acme', '/join-request/'],
      ['/join-request/acme/', '/join-request/'],
      ['/onboarding/acme/', '/onboarding/'],
      ['/onboarding/acme/project/', '/onboarding/project/'],

      ['/organizations/new/', '/organizations/new/'],
      ['/organizations/albertos-organizations/issues/', '/issues/'],
      [
        '/organizations/albertos-organizations/issues/?_q=all#hash',
        '/issues/?_q=all#hash',
      ],
      ['/acme/project-slug/getting-started/', '/getting-started/project-slug/'],
      [
        '/acme/project-slug/getting-started/python',
        '/getting-started/project-slug/python',
      ],
      ['/settings/projects/python/filters/', '/settings/projects/python/filters/'],
      ['/settings/projects/onboarding/abc123/', '/settings/projects/onboarding/abc123/'],
      [
        '/settings/projects/join-request/abc123/',
        '/settings/projects/join-request/abc123/',
      ],
      [
        '/settings/projects/python/filters/discarded/',
        '/settings/projects/python/filters/discarded/',
      ],
      [
        '/settings/projects/getting-started/abc123/',
        '/settings/projects/getting-started/abc123/',
      ],
      // Team settings links in breadcrumbs can be pre-normalized from breadcrumbs
      ['/settings/teams/peeps/', '/settings/teams/peeps/'],
      [
        '/settings/billing/checkout/?_q=all#hash',
        '/settings/billing/checkout/?_q=all#hash',
      ],
      [
        '/settings/billing/bundle-checkout/?_q=all#hash',
        '/settings/billing/bundle-checkout/?_q=all#hash',
      ],
    ];
    for (const [input, expected] of cases) {
      result = normalizeUrl(input!);
      expect(result).toEqual(expected);

      result = normalizeUrl(input!, location);
      expect(result).toEqual(expected);

      result = normalizeUrl(input!, {forceCustomerDomain: false});
      expect(result).toEqual(expected);

      result = normalizeUrl(input!, location, {forceCustomerDomain: false});
      expect(result).toEqual(expected);
    }

    // Normalizes urls if options.customerDomain is true and orgslug.sentry.io isn't being used
    ConfigStore.set('customerDomain', null);
    for (const [input, expected] of cases) {
      result = normalizeUrl(input!, {forceCustomerDomain: true});
      expect(result).toEqual(expected);

      result = normalizeUrl(input!, location, {forceCustomerDomain: true});
      expect(result).toEqual(expected);
    }

    ConfigStore.set('customerDomain', null);
    for (const [input, _expected] of cases) {
      result = normalizeUrl(input!);
      expect(result).toEqual(input);

      result = normalizeUrl(input!, location);
      expect(result).toEqual(input);
    }
  });

  it('replaces pathname in objects', function () {
    const location = LocationFixture();
    result = normalizeUrl({pathname: '/settings/acme/'}, location);
    expect(result.pathname).toBe('/settings/organization/');

    result = normalizeUrl({pathname: '/settings/acme/'}, location, {
      forceCustomerDomain: false,
    });
    expect(result.pathname).toBe('/settings/organization/');

    result = normalizeUrl({pathname: '/settings/sentry/members'}, location);
    expect(result.pathname).toBe('/settings/members');

    result = normalizeUrl({pathname: '/organizations/albertos-apples/issues'}, location);
    expect(result.pathname).toBe('/issues');

    result = normalizeUrl(
      {
        pathname: '/organizations/sentry/profiling/profile/sentry/abc123/',
        query: {sorting: 'call order'},
      },
      location
    );
    expect(result.pathname).toBe('/profiling/profile/sentry/abc123/');

    result = normalizeUrl(
      {
        pathname: '/organizations/albertos-apples/issues',
        query: {q: 'all'},
      },
      location
    );
    expect(result.pathname).toBe('/issues');

    // Normalizes urls if options.customerDomain is true and orgslug.sentry.io isn't being used
    ConfigStore.set('customerDomain', null);
    result = normalizeUrl({pathname: '/settings/acme/'}, location, {
      forceCustomerDomain: true,
    });
    expect(result.pathname).toBe('/settings/organization/');

    result = normalizeUrl(
      {
        pathname: '/organizations/albertos-apples/issues',
        query: {q: 'all'},
      },
      location,
      {
        forceCustomerDomain: true,
      }
    );
    expect(result.pathname).toBe('/issues');
  });
});
