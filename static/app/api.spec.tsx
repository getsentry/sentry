import {Request, resolveHostname} from 'sentry/api';
import {PROJECT_MOVED} from 'sentry/constants/apiErrorCodes';

import ConfigStore from './stores/configStore';
import OrganizationStore from './stores/organizationStore';

jest.unmock('sentry/api');

describe('api', function () {
  let api;

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
    api.activeRequests = {id: {alive: true}};
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
    jest.spyOn(api, 'wrapCallback').mockImplementation((_id, func) => func);
    const errorCb = jest.fn();
    const args = ['test', true, 1];
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
        {},
        {}
      )
    ).not.toThrow();
  });
});

describe('resolveHostname', function () {
  let devUi, orgstate, configstate;

  const controlPath = '/api/0/broadcasts/';
  const regionPath = '/api/0/organizations/slug/issues/';

  beforeEach(function () {
    orgstate = OrganizationStore.get();
    configstate = ConfigStore.getState();
    devUi = window.__SENTRY_DEV_UI;

    OrganizationStore.onUpdate(
      TestStubs.Organization({features: ['frontend-domainsplit']})
    );
    ConfigStore.loadInitialData({
      ...configstate,
      links: {
        organizationUrl: 'https://acme.sentry.io',
        sentryUrl: 'https://sentry.io',
        regionUrl: 'https://us.sentry.io',
      },
    });
  });

  afterEach(() => {
    window.__SENTRY_DEV_UI = devUi;
    OrganizationStore.onUpdate(orgstate.organization);
    ConfigStore.loadInitialData(configstate);
  });

  it('does nothing without feature', function () {
    // Org does not have the required feature.
    OrganizationStore.onUpdate(TestStubs.Organization());

    let result = resolveHostname(controlPath);
    expect(result).toBe(controlPath);

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
    OrganizationStore.onUpdate(TestStubs.Organization());

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
