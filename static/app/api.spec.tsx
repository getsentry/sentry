import {OrganizationFixture} from 'sentry-fixture/organization';

import type {ResponseMeta} from 'sentry/api';
import {Client, Request, resolveHostname} from 'sentry/api';
import {PROJECT_MOVED} from 'sentry/constants/apiErrorCodes';

import ConfigStore from './stores/configStore';
import OrganizationStore from './stores/organizationStore';

jest.unmock('sentry/api');

describe('api', function () {
  let api: Client;

  beforeEach(function () {
    api = new MockApiClient();
  });

  describe('Client', function () {
    describe('cancel()', function () {
      it('should abort any open XHR requests', function () {
        const abort1 = jest.fn();
        const abort2 = jest.fn();

        const req1 = new Request(new Promise(() => null), {
          abort: abort1,
        } as any);
        const req2 = new Request(new Promise(() => null), {abort: abort2} as any);

        api.activeRequests = {
          1: req1,
          2: req2,
        };

        api.clear();

        expect(req1.aborter?.abort).toHaveBeenCalledTimes(1);
        expect(req2.aborter?.abort).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('does not call success callback if 302 was returned because of a project slug change', function () {
    const successCb = jest.fn();
    api.activeRequests = {
      id: {alive: true, requestPromise: new Promise(() => null), cancel: jest.fn()},
    };
    api.wrapCallback(
      'id',
      successCb
    )({
      responseJSON: {
        detail: {
          code: PROJECT_MOVED,
          message: '...',
          extra: {
            slug: 'new-slug',
          },
        },
      },
    });
    expect(successCb).not.toHaveBeenCalled();
  });

  it('handles error callback', function () {
    jest.spyOn(api, 'wrapCallback').mockImplementation((_id: string, func: any) => func);
    const errorCb = jest.fn();
    const args = ['test', true, 1] as unknown as [ResponseMeta, string, string];
    api.handleRequestError(
      {
        id: 'test',
        path: 'test',
        requestOptions: {error: errorCb},
      },
      ...args
    );

    expect(errorCb).toHaveBeenCalledWith(...args);
  });

  it('handles undefined error callback', function () {
    expect(() =>
      api.handleRequestError(
        {
          id: 'test',
          path: 'test',
          requestOptions: {},
        },
        {} as ResponseMeta,
        '',
        'test'
      )
    ).not.toThrow();
  });
});

describe('resolveHostname', function () {
  let devUi: boolean | undefined;
  let location: Location;
  let configstate: ReturnType<typeof ConfigStore.getState>;

  const controlPath = '/api/0/broadcasts/';
  const regionPath = '/api/0/organizations/slug/issues/';

  beforeEach(function () {
    configstate = ConfigStore.getState();
    location = window.location;
    devUi = window.__SENTRY_DEV_UI;

    ConfigStore.loadInitialData({
      ...configstate,
      features: new Set(['system:multi-region']),
      links: {
        organizationUrl: 'https://acme.sentry.io',
        sentryUrl: 'https://sentry.io',
        regionUrl: 'https://us.sentry.io',
      },
    });
  });

  afterEach(() => {
    window.location = location;
    window.__SENTRY_DEV_UI = devUi;
    ConfigStore.loadInitialData(configstate);
  });

  it('does nothing without feature', function () {
    ConfigStore.loadInitialData({
      ...configstate,
      // Remove the feature flag
      features: new Set(),
    });

    let result = resolveHostname(controlPath);
    expect(result).toBe(controlPath);

    // Explicit domains still work.
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(`https://sentry.io${controlPath}`);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`https://de.sentry.io${regionPath}`);
  });

  it('does not override region in _admin', function () {
    Object.defineProperty(window, 'location', {
      configurable: true,
      enumerable: true,
      value: new URL('https://sentry.io/_admin/'),
    });

    // Adds domain to control paths
    let result = resolveHostname(controlPath);
    expect(result).toBe('https://sentry.io/api/0/broadcasts/');

    // Doesn't add domain to region paths
    result = resolveHostname(regionPath);
    expect(result).toBe(regionPath);

    // Explicit domains still work.
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(`https://sentry.io${controlPath}`);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`https://de.sentry.io${regionPath}`);
  });

  it('adds domains when feature enabled', function () {
    let result = resolveHostname(regionPath);
    expect(result).toBe('https://us.sentry.io/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('https://sentry.io/api/0/broadcasts/');
  });

  it('matches if querystrings are in path', function () {
    const result = resolveHostname(
      '/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
    expect(result).toBe(
      'https://sentry.io/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
  });

  it('uses paths for region silo in dev-ui', function () {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath);
    expect(result).toBe('/region/us/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests', function () {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath, 'https://sentry.io');
    expect(result).toBe('/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests when feature is off', function () {
    window.__SENTRY_DEV_UI = true;
    // Org does not have the required feature.
    OrganizationStore.onUpdate(OrganizationFixture());

    let result = resolveHostname(controlPath);
    expect(result).toBe(controlPath);

    // control silo shaped URLs don't get a host
    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe(controlPath);

    result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe(`/region/de${regionPath}`);
  });

  it('preserves host parameters', function () {
    const result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe('https://de.sentry.io/api/0/organizations/slug/issues/');
  });
});

describe('isSimilarOrigin', function () {
  test.each([
    // Same domain
    ['https://sentry.io', 'https://sentry.io', true],
    ['https://example.io', 'https://example.io', true],

    // Not the same
    ['https://example.io', 'https://sentry.io', false],
    ['https://sentry.io', 'https://io.sentry', false],

    // Sibling domains
    ['https://us.sentry.io', 'https://sentry.sentry.io', true],
    ['https://us.sentry.io', 'https://acme.sentry.io', true],
    ['https://us.sentry.io', 'https://eu.sentry.io', true],
    ['https://woof.sentry.io', 'https://woof-org.sentry.io', true],
    ['https://woof.sentry.io/issues/1234/', 'https://woof-org.sentry.io', true],

    // Subdomain
    ['https://sentry.io/api/0/broadcasts/', 'https://woof.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://sentry.sentry.io', true],
    ['https://sentry.io/api/0/users/', 'https://io.sentry.io', true],
    // request to subdomain from parent
    ['https://us.sentry.io/api/0/users/', 'https://sentry.io', true],

    // Not siblings
    ['https://sentry.io/api/0/broadcasts/', 'https://sentry.example.io', false],
    ['https://acme.sentry.io', 'https://acme.sent.ryio', false],
    ['https://woof.example.io', 'https://woof.sentry.io', false],
    ['https://woof.sentry.io', 'https://sentry.woof.io', false],
  ])('allows sibling domains %s and %s is %s', (target, origin, expected) => {
    expect(Client.isSimilarOrigin(target, origin)).toBe(expected);
  });
});
