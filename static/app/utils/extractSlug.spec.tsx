import {setWindowLocation} from 'sentry-test/utils';

import {extractSlug} from 'sentry/utils/extractSlug';

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

describe('extractSlug', () => {
  it.each([
    {hostname: 'example.com'},
    {hostname: 'example.com:443'},
    {hostname: 'acme.example.com'},
    {hostname: 'acme.example.com:443'},
    {hostname: 'sentry.io'},
    {hostname: 'sentry.io:443'},
    {hostname: 'acme.sentry.io'},
    {hostname: 'acme.sentry.io:443'},
  ])(
    'should return null when not using known dev hostnames "$hostname"',
    ({hostname}) => {
      expect(extractSlug(hostname)).toBeNull();
    }
  );

  it.each([
    {hostname: 'localhost', slug: '', domain: 'localhost'},
    {hostname: 'localhost:7999', slug: '', domain: 'localhost:7999'},
    {hostname: 'acme.localhost', slug: 'acme', domain: 'localhost'},
    {
      hostname: 'acme.localhost:7999',
      slug: 'acme',
      domain: 'localhost:7999',
    },
    {hostname: 'dev.getsentry.net', slug: '', domain: 'dev.getsentry.net'},
    {
      hostname: 'dev.getsentry.net:7999',
      slug: '',
      domain: 'dev.getsentry.net:7999',
    },
    {
      hostname: 'acme.dev.getsentry.net',
      slug: 'acme',
      domain: 'dev.getsentry.net',
    },
    {
      hostname: 'acme.sentry-inst123.dev.getsentry.net',
      slug: 'acme',
      domain: 'sentry-inst123.dev.getsentry.net',
    },
    {
      hostname: 'acme.dev.getsentry.net:7999',
      slug: 'acme',
      domain: 'dev.getsentry.net:7999',
    },
    {hostname: 'sentry.dev', slug: '', domain: 'sentry.dev'},
    {hostname: 'sentry.dev:7999', slug: '', domain: 'sentry.dev:7999'},
    {hostname: 'acme.sentry.dev', slug: 'acme', domain: 'sentry.dev'},
    {
      hostname: 'acme.sentry-inst123.sentry.dev',
      slug: 'acme',
      domain: 'sentry-inst123.sentry.dev',
    },
    {
      hostname: 'acme.sentry.dev:7999',
      slug: 'acme',
      domain: 'sentry.dev:7999',
    },
    {
      hostname: 'acme.sentry-inst123.sentry.dev:7999',
      slug: 'acme',
      domain: 'sentry-inst123.sentry.dev:7999',
    },
  ])('should split "$slug" & "$domain" from $hostname', ({hostname, slug, domain}) => {
    expect(extractSlug(hostname)).toStrictEqual({slug, domain});
  });
});

describe('getDevUiOrganizationSlug', () => {
  let devUi: boolean | undefined;

  // Test setup imports this module before the constants mock is installed.
  async function getDevUiOrganizationSlug() {
    jest.resetModules();
    const module = await import('sentry/utils/extractSlug');
    return module.getDevUiOrganizationSlug();
  }

  beforeEach(() => {
    devUi = window.__SENTRY_DEV_UI;
    window.__SENTRY_DEV_UI = true;
    mockDeployPreviewConfig.mockReturnValue(undefined);
  });

  afterEach(() => {
    window.__SENTRY_DEV_UI = devUi;
  });

  it('returns the organization from a dev-ui organization domain', async () => {
    setWindowLocation('https://acme.dev.getsentry.net:7999/issues/');
    expect(await getDevUiOrganizationSlug()).toBe('acme');
  });

  it('returns null without an organization subdomain', async () => {
    setWindowLocation('https://dev.getsentry.net:7999/issues/');
    expect(await getDevUiOrganizationSlug()).toBeNull();
  });

  it('returns null outside dev-ui', async () => {
    window.__SENTRY_DEV_UI = undefined;
    setWindowLocation('https://acme.dev.getsentry.net:7999/issues/');
    expect(await getDevUiOrganizationSlug()).toBeNull();
  });

  it('ignores the deployment host on deploy previews', async () => {
    mockDeployPreviewConfig.mockReturnValue({
      branch: 'test',
      commitSha: 'abc123',
      githubOrg: 'getsentry',
      githubRepo: 'sentry',
    });
    setWindowLocation('https://sentry-abc123.sentry.dev/issues/');
    expect(await getDevUiOrganizationSlug()).toBeNull();
  });
});
