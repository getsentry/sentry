import {OrganizationFixture} from 'sentry-fixture/organization';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

import {resolveRoute} from './resolveRoute';

const mockDeployPreviewConfig = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstants = jest.requireActual('sentry/constants');
  return {
    ...sentryConstants,
    get DEPLOY_PREVIEW_CONFIG() {
      return mockDeployPreviewConfig();
    },
  };
});

describe('resolveRoute', () => {
  let devUi: any, host: any;
  let configState: Config;

  const organization = OrganizationFixture();
  const otherOrg = OrganizationFixture({
    slug: 'other-org',
  });

  beforeEach(() => {
    devUi = window.__SENTRY_DEV_UI;
    host = window.location.host;
    configState = ConfigStore.getState();
    ConfigStore.set('features', new Set(['system:multi-region']));
  });
  afterEach(() => {
    window.__SENTRY_DEV_UI = devUi;
    window.location.host = host;
    ConfigStore.loadInitialData(configState);

    mockDeployPreviewConfig.mockReset();
  });

  it('should replace domains with dev-ui mode on localhost', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'acme.localhost:7999';

    const result = resolveRoute('/issues/', organization, otherOrg);
    expect(result).toBe('https://other-org.localhost:7999/issues/');
  });

  it('should replace domains with dev-ui mode on dev.getsentry.net', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'acme.dev.getsentry.net:7999';

    const result = resolveRoute('/issues/', organization, otherOrg);
    expect(result).toBe('https://other-org.dev.getsentry.net:7999/issues/');
  });

  it('should use path slugs on sentry.dev', () => {
    // Vercel previews don't let us have additional subdomains.
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'sentry-abc123.sentry.dev';

    mockDeployPreviewConfig.mockReturnValue({
      branch: 'test',
      commitSha: 'abc123',
      githubOrg: 'getsentry',
      githubRepo: 'sentry',
    });

    const result = resolveRoute(
      `/organizations/${otherOrg.slug}/issues/`,
      organization,
      otherOrg
    );
    expect(result).toBe(
      'https://sentry-abc123.sentry.dev/organizations/other-org/issues/'
    );
  });

  it('will not replace domains with dev-ui mode and an unsafe host', () => {
    window.__SENTRY_DEV_UI = true;
    window.location.host = 'bad-domain.com';

    const result = resolveRoute('/issues/', organization, otherOrg);
    expect(result).toBe('https://other-org.sentry.io/issues/');
  });

  it('should add domain when switching orgs with multi-region flag', () => {
    let result = resolveRoute('/issues/', organization, otherOrg);
    expect(result).toBe('https://other-org.sentry.io/issues/');

    // Same result when we don't have a current org
    result = resolveRoute('/issues/', null, otherOrg);
    expect(result).toBe('https://other-org.sentry.io/issues/');
  });

  it('should use path slugs when switching orgs without multi-region', () => {
    ConfigStore.set('features', new Set([]));
    ConfigStore.set('customerDomain', null);

    const result = resolveRoute(
      `/organizations/${organization.slug}/issues/`,
      organization
    );
    expect(result).toBe(`/organizations/${organization.slug}/issues/`);
  });

  it('should use slugless URL when org has customer domains', () => {
    ConfigStore.set('customerDomain', {
      subdomain: otherOrg.slug,
      organizationUrl: `https://${otherOrg.slug}.sentry.io`,
      sentryUrl: `https://sentry.io`,
    });

    const result = resolveRoute(`/organizations/${otherOrg.slug}/issues/`, otherOrg);
    expect(result).toBe(`/issues/`);
  });
});
