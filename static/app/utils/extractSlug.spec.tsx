import {extractSlug} from 'sentry/utils/extractSlug';

describe('extractSlug', () => {
  let devUiProxyHost: any;

  beforeEach(() => {
    devUiProxyHost = window.__SENTRY_DEV_UI_PROXY_HOST;
  });
  afterEach(() => {
    window.__SENTRY_DEV_UI_PROXY_HOST = devUiProxyHost;
  });

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
    expect(extractSlug(hostname)).toStrictEqual({slug, domain, separator: '.'});
  });

  describe('--- prefixed hosts', () => {
    // A wildcard certificate covers one DNS label, so hosts that cannot spend a
    // label on the organization prefix the single label they own instead.
    it.each([
      {
        name: 'Coder workspace app',
        hostname: 'acme---dev-ui--workspace--owner.coder.sentry.dev',
        slug: 'acme',
        domain: 'dev-ui--workspace--owner.coder.sentry.dev',
      },
      {
        name: 'Vercel multi-tenant preview URL',
        hostname: 'acme---sentry-git-my-branch.sentry.dev',
        slug: 'acme',
        domain: 'sentry-git-my-branch.sentry.dev',
      },
      {
        name: 'a port is kept on the domain',
        hostname: 'acme---dev-ui--workspace--owner.localhost:7999',
        slug: 'acme',
        domain: 'dev-ui--workspace--owner.localhost:7999',
      },
      {
        name: 'a slug containing a double dash is not split early',
        hostname: 'acme--corp---dev-ui--workspace--owner.coder.sentry.dev',
        slug: 'acme--corp',
        domain: 'dev-ui--workspace--owner.coder.sentry.dev',
      },
    ])('splits $name', ({hostname, slug, domain}) => {
      expect(extractSlug(hostname)).toStrictEqual({
        slug,
        domain,
        separator: '---',
      });
    });

    it('still reads a prefix while behind a proxy', () => {
      window.__SENTRY_DEV_UI_PROXY_HOST = 'dev-ui--workspace--owner.coder.sentry.dev';

      expect(
        extractSlug('acme---dev-ui--workspace--owner.coder.sentry.dev')
      ).toStrictEqual({
        slug: 'acme',
        domain: 'dev-ui--workspace--owner.coder.sentry.dev',
        separator: '---',
      });
    });

    it('reads no organization from a proxy host without a prefix', () => {
      // `dev-ui--workspace--owner` is the tunnel's name for itself. Without this
      // it matches the `sentry.dev` arm and reads as an organization slug.
      window.__SENTRY_DEV_UI_PROXY_HOST = 'dev-ui--workspace--owner.coder.sentry.dev';

      expect(extractSlug('dev-ui--workspace--owner.coder.sentry.dev')).toBeNull();
    });

    it('does not read a prefix off an unknown host', () => {
      expect(extractSlug('acme---evil.example.com')).toBeNull();
    });
  });
});
