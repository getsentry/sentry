import {OrganizationFixture} from 'sentry-fixture/organization';

import {setWindowLocation} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {resolveHostname} from 'sentry/utils/api/resolveHostname';

describe('resolveHostname', () => {
  let devUi: boolean | undefined;
  let location: Location;
  let configstate: ReturnType<typeof ConfigStore.getState>;

  const controlPath = '/api/0/broadcasts/';
  const regionPath = '/api/0/organizations/slug/issues/';

  beforeEach(() => {
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
    window.location = location as typeof window.location & string;
    window.__SENTRY_DEV_UI = devUi;
    ConfigStore.loadInitialData(configstate);
  });

  it('does nothing without feature', () => {
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

  it('does not override region in _admin', () => {
    setWindowLocation('https://sentry.io/_admin/');

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

  it('adds domains when feature enabled', () => {
    setWindowLocation('https://us.sentry.io/');
    let result = resolveHostname(regionPath);
    expect(result).toBe('https://us.sentry.io/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('https://sentry.io/api/0/broadcasts/');
  });

  it('matches if querystrings are in path', () => {
    const result = resolveHostname(
      '/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
    expect(result).toBe(
      'https://sentry.io/api/0/organizations/acme/sentry-app-components/?projectId=123'
    );
  });

  it('uses paths for region silo in dev-ui', () => {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath);
    expect(result).toBe('/region/us/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath);
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests', () => {
    window.__SENTRY_DEV_UI = true;

    let result = resolveHostname(regionPath, 'https://sentry.io');
    expect(result).toBe('/api/0/organizations/slug/issues/');

    result = resolveHostname(controlPath, 'https://sentry.io');
    expect(result).toBe('/api/0/broadcasts/');
  });

  it('removes sentryUrl from dev-ui mode requests when feature is off', () => {
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

  it('preserves host parameters', () => {
    const result = resolveHostname(regionPath, 'https://de.sentry.io');
    expect(result).toBe('https://de.sentry.io/api/0/organizations/slug/issues/');
  });
});
