/**
 * @jest-environment-options {"url": "https://sentry.io/issues/"}
 */
import {
  getFirstPartyOrigins,
  isDefinitelyThirdPartyFrame,
  isSeeminglyFirstPartyFrame,
  isThirdPartyScriptEvent,
} from './thirdPartyScriptFilter';

const CDN = 'https://s1.sentry-cdn.com';
const DIST_PREFIX = `${CDN}/_static/dist/sentry/`;
const APP_CHUNK = `${DIST_PREFIX}chunks/56177.cad95fee92a5a772.js`;
const ORIGINS = ['https://sentry.io', CDN];

describe('isSeeminglyFirstPartyFrame', () => {
  describe('frames without a usable filename', () => {
    it('returns false when the filename is missing', () => {
      expect(isSeeminglyFirstPartyFrame({filename: undefined}, ORIGINS)).toBe(false);
    });

    it('returns false when the filename is empty', () => {
      expect(isSeeminglyFirstPartyFrame({filename: ''}, ORIGINS)).toBe(false);
    });

    it('returns false for an anonymous frame', () => {
      expect(isSeeminglyFirstPartyFrame({filename: '<anonymous>'}, ORIGINS)).toBe(false);
    });

    it('returns false for a native frame', () => {
      expect(isSeeminglyFirstPartyFrame({filename: '[native code]'}, ORIGINS)).toBe(
        false
      );
    });

    it('returns false for an unknown frame', () => {
      expect(isSeeminglyFirstPartyFrame({filename: '<unknown>'}, ORIGINS)).toBe(false);
    });
  });

  describe('frames attributed to a document', () => {
    it('returns false for the page root', () => {
      expect(isSeeminglyFirstPartyFrame({filename: 'https://sentry.io/'}, ORIGINS)).toBe(
        false
      );
    });

    it('returns false for a page path', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://sentry.io/issues/'}, ORIGINS)
      ).toBe(false);
    });

    it('returns false for a page path without a trailing slash', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://sentry.io/issues'}, ORIGINS)
      ).toBe(false);
    });

    it('returns false for a page path with a query string', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/issues/?project=1234567890'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a page path with a hash', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/settings/account/emails/#email'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a page path ending in an id', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/issues/1234567890/?referrer=issue-stream'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for the asset origin root', () => {
      expect(isSeeminglyFirstPartyFrame({filename: `${CDN}/`}, ORIGINS)).toBe(false);
    });

    it('returns true when a page path names a file', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/settings/projects/com.example.app'},
          ORIGINS
        )
      ).toBe(true);
    });
  });

  describe('frames from assets we serve', () => {
    it('returns true for a chunk on the asset origin', () => {
      expect(isSeeminglyFirstPartyFrame({filename: APP_CHUNK}, ORIGINS)).toBe(true);
    });

    it('returns true for an asset on the page origin', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/_assets/app.abcdefg.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for the service worker', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/service-worker.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for an asset with a query string', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/_assets/app.js?v=2'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for an asset with a hash', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/_assets/app.js#chunk'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a root-relative filename', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: '/_assets/app.abcdefg.js'}, ORIGINS)
      ).toBe(true);
    });

    it('returns true for a bare relative filename', () => {
      expect(isSeeminglyFirstPartyFrame({filename: 'app.abcdefg.js'}, ORIGINS)).toBe(
        true
      );
    });

    it('returns true for a dot-relative filename', () => {
      expect(isSeeminglyFirstPartyFrame({filename: './chunks/56177.js'}, ORIGINS)).toBe(
        true
      );
    });

    it('returns true for a module extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/_assets/tslib.es6.mjs'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for the sdk loader cdn', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://js.sentry-cdn.com/loader.min.js'},
          ['https://sentry.io']
        )
      ).toBe(true);
    });

    it('returns true for the browser bundle cdn', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://browser.sentry-cdn.com/8.0.0/bundle.min.js'},
          ['https://sentry.io']
        )
      ).toBe(true);
    });

    it('returns true for the asset cdn even when it is not a listed origin', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: APP_CHUNK}, ['https://sentry.io'])
      ).toBe(true);
    });

    it('returns true for the cdn apex domain', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://sentry-cdn.com/app.js'}, [
          'https://sentry.io',
        ])
      ).toBe(true);
    });

    it('returns true for an uppercase extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io/_assets/APP.JS'},
          ORIGINS
        )
      ).toBe(true);
    });
  });

  describe('frames from hosts we own', () => {
    it('returns true for the page host without a listed origin', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://sentry.io/_assets/app.js'}, [])
      ).toBe(true);
    });

    it('returns true for a customer domain asset', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://org-slug.sentry.io/_assets/app.js'},
          []
        )
      ).toBe(true);
    });

    it('returns false when our host is only a prefix of another domain', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry.io.evil.example/app.js'},
          []
        )
      ).toBe(false);
    });

    it('returns true when the cdn host is uppercase', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://S1.SENTRY-CDN.COM/app.js'}, [
          'https://sentry.io',
        ])
      ).toBe(true);
    });

    it('returns true when the cdn host is on a nonstandard port', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://s1.sentry-cdn.com:8443/app.js'}, [
          'https://sentry.io',
        ])
      ).toBe(true);
    });

    it('returns false when the cdn name is only a userinfo prefix', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry-cdn.com@evil.example/app.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns true for an extension url whose host looks like our cdn', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'chrome-extension://s1.sentry-cdn.com/content.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns false for a lookalike top level domain', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://s1.sentry-cdn.xn--com-9o0a/app.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false when the host merely ends with the cdn name', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://xsentry-cdn.com/app.js'}, ORIGINS)
      ).toBe(false);
    });

    it('returns false when the cdn host is a fully qualified trailing dot', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://s1.sentry-cdn.com./app.js'}, [
          'https://sentry.io',
        ])
      ).toBe(false);
    });
  });

  describe('frames from origins we do not serve', () => {
    it('returns false for a vendor cdn', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://cdn.pendo.io/agent/static/abc/pendo.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for an analytics host', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://api2.amplitude.com/collect.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a protocol-relative url', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: '//cdn.example.com/agent.js'}, ORIGINS)
      ).toBe(false);
    });

    it('returns false when only the port differs', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://app.example.com:8443/app.js'}, [
          'https://app.example.com',
        ])
      ).toBe(false);
    });

    it('returns false when only the scheme differs', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'http://app.example.com/app.js'}, [
          'https://app.example.com',
        ])
      ).toBe(false);
    });

    it('returns false for a host that only ends with our cdn name', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'https://sentry-cdn.com.evil.example/app.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a subdomain of the page origin', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://static.example.com/app.js'}, [
          'https://example.com',
        ])
      ).toBe(false);
    });

    it('returns false when there are no first-party origins', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'https://app.example.com/app.js'}, [])
      ).toBe(false);
    });
  });

  describe('frames from browser extensions', () => {
    it('returns false for a chrome extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'chrome-extension://hoklmmgfnpapgjgcpechhaamimifchmp/frame_ant.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a firefox extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'moz-extension://abcdefg/inject.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a safari web extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'safari-web-extension://ABC-123/content.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a legacy safari extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'safari-extension://ABC-123/legacy.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for an edge extension', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'ms-browser-extension://abcdefg/content.js'},
          ORIGINS
        )
      ).toBe(false);
    });
  });

  describe('frames from other schemes', () => {
    it('returns false for a blob url', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'blob:https://sentry.io/9d3a8f2e-1c4b-4e7a-9f3d-2b8c1e5a7d90'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a data url', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'data:text/javascript,console.log(1)'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for about:blank', () => {
      expect(isSeeminglyFirstPartyFrame({filename: 'about:blank'}, ORIGINS)).toBe(false);
    });

    it('returns false for a browser internal module', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'resource://gre/modules/ExtensionContent.sys.mjs'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a local file', () => {
      expect(
        isSeeminglyFirstPartyFrame({filename: 'file:///Users/dogs/are/great.js'}, ORIGINS)
      ).toBe(false);
    });

    it('returns true for the dev bundler scheme', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'webpack-internal:///./app/views/issueList/index.tsx'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a dev bundler path that names no file', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'webpack-internal:///./app/views/issueList/index'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns false for a sourcemapped bundler path', () => {
      expect(
        isSeeminglyFirstPartyFrame(
          {filename: 'webpack:///./app/views/issueList/index.tsx'},
          ORIGINS
        )
      ).toBe(false);
    });
  });

  describe('filenames that are not urls', () => {
    it('returns true for a scheme with no host', () => {
      expect(isSeeminglyFirstPartyFrame({filename: 'http://'}, ORIGINS)).toBe(true);
    });

    it('returns true for a bare scheme', () => {
      expect(isSeeminglyFirstPartyFrame({filename: 'https://'}, ORIGINS)).toBe(true);
    });
  });
});

describe('isDefinitelyThirdPartyFrame', () => {
  describe('code served by someone else', () => {
    it('returns true for a chrome extension', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'chrome-extension://hoklmmgfnpapgjgcpechhaamimifchmp/frame_ant.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a firefox extension', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'moz-extension://abcdefg/inject.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a safari web extension', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'safari-web-extension://ABC-123/content.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a legacy safari extension', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'safari-extension://ABC-123/legacy.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for an edge extension', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'ms-browser-extension://abcdefg/content.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a vendor cdn', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://cdn.pendo.io/agent/static/abc/pendo.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a document on a host we do not serve', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://third-party.example/embed/'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a protocol-relative url', () => {
      expect(
        isDefinitelyThirdPartyFrame({filename: '//cdn.example.com/agent.js'}, ORIGINS)
      ).toBe(true);
    });

    it('returns true for a host that only ends with our cdn name', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://sentry-cdn.com.evil.example/app.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true when only the port differs', () => {
      expect(
        isDefinitelyThirdPartyFrame({filename: 'https://app.example.com:8443/app.js'}, [
          'https://app.example.com',
        ])
      ).toBe(true);
    });

    it('returns true when only the scheme differs', () => {
      expect(
        isDefinitelyThirdPartyFrame({filename: 'http://app.example.com/app.js'}, [
          'https://app.example.com',
        ])
      ).toBe(true);
    });

    it('returns true when the cdn name is only a userinfo prefix', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://sentry-cdn.com@evil.example/app.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true when our host is only a prefix of another domain', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://sentry.io.evil.example/app.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for a lookalike top level domain', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://s1.sentry-cdn.xn--com-9o0a/app.js'},
          ORIGINS
        )
      ).toBe(true);
    });

    it('returns true for an extension url whose host looks like our cdn', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'chrome-extension://s1.sentry-cdn.com/content.js'},
          ORIGINS
        )
      ).toBe(true);
    });
  });

  describe('code we serve', () => {
    it('returns false for an asset on the page origin', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://sentry.io/_assets/app.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a document on the page origin', () => {
      expect(
        isDefinitelyThirdPartyFrame({filename: 'https://sentry.io/issues/'}, ORIGINS)
      ).toBe(false);
    });

    it('returns false for a chunk on the asset origin', () => {
      expect(isDefinitelyThirdPartyFrame({filename: APP_CHUNK}, ORIGINS)).toBe(false);
    });

    it('returns false for the sdk loader cdn', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'https://js.sentry-cdn.com/loader.min.js'},
          ['https://sentry.io']
        )
      ).toBe(false);
    });

    it('returns false for a relative filename', () => {
      expect(isDefinitelyThirdPartyFrame({filename: 'app.abcdefg.js'}, ORIGINS)).toBe(
        false
      );
    });

    it('returns false for the dev bundler scheme', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'webpack-internal:///./app/views/issueList/index.tsx'},
          ORIGINS
        )
      ).toBe(false);
    });
  });

  describe('frames we cannot attribute', () => {
    it('returns false when the filename is missing', () => {
      expect(isDefinitelyThirdPartyFrame({filename: undefined}, ORIGINS)).toBe(false);
    });

    it('returns false when the filename is empty', () => {
      expect(isDefinitelyThirdPartyFrame({filename: ''}, ORIGINS)).toBe(false);
    });

    it('returns false for an anonymous frame', () => {
      expect(isDefinitelyThirdPartyFrame({filename: '<anonymous>'}, ORIGINS)).toBe(false);
    });

    it('returns false for a native frame', () => {
      expect(isDefinitelyThirdPartyFrame({filename: '[native code]'}, ORIGINS)).toBe(
        false
      );
    });

    it('returns false for a blob url', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'blob:https://sentry.io/9d3a8f2e-1c4b-4e7a-9f3d-2b8c1e5a7d90'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a data url', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'data:text/javascript,console.log(1)'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for about:blank', () => {
      expect(isDefinitelyThirdPartyFrame({filename: 'about:blank'}, ORIGINS)).toBe(false);
    });

    it('returns false for a local file', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'file:///Users/dogs/are/great.js'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a blob url from a host we do not serve', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'blob:https://cdn.example.com/uuid'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a sourcemapped bundler path', () => {
      expect(
        isDefinitelyThirdPartyFrame(
          {filename: 'webpack:///./app/views/issueList/index.tsx'},
          ORIGINS
        )
      ).toBe(false);
    });

    it('returns false for a filename that is not a url', () => {
      expect(isDefinitelyThirdPartyFrame({filename: 'http://'}, ORIGINS)).toBe(false);
    });
  });
});

describe('getFirstPartyOrigins', () => {
  it('returns the page and asset origins when assets are on a cdn', () => {
    const origins = getFirstPartyOrigins(DIST_PREFIX);

    expect(origins).toEqual(['https://sentry.io', CDN]);
  });

  it('returns the page origin when the prefix is a path', () => {
    const origins = getFirstPartyOrigins('/_static/dist/sentry/');

    expect(origins).toEqual(['https://sentry.io', 'https://sentry.io']);
  });

  it('returns the page origin when there is no prefix', () => {
    const origins = getFirstPartyOrigins(undefined);

    expect(origins).toEqual(['https://sentry.io', 'https://sentry.io']);
  });

  it('returns the asset origin when the prefix is protocol-relative', () => {
    const origins = getFirstPartyOrigins('//cdn.example.com/assets/');

    expect(origins).toEqual(['https://sentry.io', 'https://cdn.example.com']);
  });

  it('returns only the page origin when the prefix cannot be resolved', () => {
    const origins = getFirstPartyOrigins('http://');

    expect(origins).toEqual(['https://sentry.io']);
  });
});

describe('isThirdPartyScriptEvent', () => {
  const eventWithFrames = (...filenames: Array<string | undefined>) => ({
    exception: {
      values: [{stacktrace: {frames: filenames.map(filename => ({filename}))}}],
    },
  });

  const eventWithChainedFrames = (...chain: string[][]) => ({
    exception: {
      values: chain.map(filenames => ({
        stacktrace: {frames: filenames.map(filename => ({filename}))},
      })),
    },
  });

  describe('third-party stacks', () => {
    // Frame shapes are copied from real events in the `javascript` project, so
    // that quirks like query strings and hashes on the document URL stay covered.
    it('returns true when an injected script is attributed to the page url', () => {
      const event = eventWithFrames(
        'https://sentry.io/issues/',
        'https://sentry.io/issues/',
        'https://sentry.io/issues/',
        '<anonymous>'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when the page url carries a query string', () => {
      const event = eventWithFrames(
        'https://sentry.io/issues/?project=1234567890',
        'https://sentry.io/issues/?project=1234567890',
        '<anonymous>'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when the page url carries a hash', () => {
      const event = eventWithFrames(
        'https://sentry.io/settings/account/emails/#email',
        'https://sentry.io/settings/account/emails/#email'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when the page url carries many encoded query params', () => {
      const event = eventWithFrames(
        'https://sentry.io/explore/errors/homepage/?dataset=errors&field=title&name=All%20Errors&statsPeriod=14d',
        '<anonymous>'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when the page url ends in a numeric id segment', () => {
      const event = eventWithFrames(
        'https://sentry.io/issues/1234567890/?referrer=issue-stream',
        'https://sentry.io/issues/1234567890/?referrer=issue-stream'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when frames come from another customer domain', () => {
      const event = eventWithFrames(
        'https://other-org.sentry.io/auth/login/',
        'https://other-org.sentry.io/auth/login/'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when every frame is anonymous', () => {
      const event = eventWithFrames(
        '<anonymous>',
        '<anonymous>',
        '<anonymous>',
        '<anonymous>'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when every frame comes from a browser extension', () => {
      const event = eventWithFrames(
        'chrome-extension://hoklmmgfnpapgjgcpechhaamimifchmp/frame_ant/frame_ant.js',
        'moz-extension://abcdefg/inject.js'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when every frame comes from a host we do not serve', () => {
      const event = eventWithFrames(
        'https://cdn.example.com/agent/static/abcdefg/agent.js',
        'https://js.example.com/v3/checkout.js'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when frames mix extension, vendor, and anonymous code', () => {
      const event = eventWithFrames(
        'chrome-extension://abcdefg/content.js',
        'https://cdn.example.com/agent.js',
        '<anonymous>',
        'https://sentry.io/settings/'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when frames are native or missing a filename', () => {
      const event = eventWithFrames(undefined, '', '[native code]');

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when an extension frame sits above our own code', () => {
      const event = eventWithFrames(
        'chrome-extension://mpejmbnlbgamjhgnoongmdnpmhoeilje/ui-loader.js',
        APP_CHUNK
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when a vendor frame sits above our own code', () => {
      const event = eventWithFrames(
        'https://cdn.pendo.io/agent/static/abc/pendo.js',
        APP_CHUNK
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true for a document stack under derived origins', () => {
      const event = eventWithFrames('https://sentry.io/issues/', '<anonymous>');

      expect(
        isThirdPartyScriptEvent(event, getFirstPartyOrigins(DIST_PREFIX))
      ).toBeTruthy();
    });

    it('returns true for assets on a host we do not recognise', () => {
      const event = eventWithFrames('https://sentry-preview.vercel.app/_assets/app.js');

      expect(isThirdPartyScriptEvent(event, [])).toBeTruthy();
    });

    it('returns true when every frame is a local file', () => {
      const event = eventWithFrames(
        'file:///Users/dogs/are/great.js',
        'file:///Users/dogs/are/great.js'
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when every chained error is third-party', () => {
      const event = eventWithChainedFrames(
        ['https://sentry.io/issues/', '<anonymous>'],
        ['chrome-extension://abcdefg/content.js']
      );

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
    });

    it('returns true when the asset origin is no longer served from', () => {
      const event = eventWithFrames(
        'https://assets.example.com/app.js',
        'https://assets.example.com/app.js'
      );

      expect(isThirdPartyScriptEvent(event, ['https://sentry.io'])).toBeTruthy();
    });
  });

  it('returns true when an extension frame comes after our own frames', () => {
    const event = eventWithFrames(
      APP_CHUNK,
      'https://sentry.io/_assets/app.js',
      'chrome-extension://abcdefg/content.js'
    );

    expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
  });

  it('returns true when only a chained error has a third-party frame', () => {
    const event = eventWithChainedFrames(
      [APP_CHUNK],
      ['chrome-extension://abcdefg/content.js']
    );

    expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
  });

  it('returns true when an extension url has a host that looks like our cdn', () => {
    const event = eventWithFrames(
      APP_CHUNK,
      'chrome-extension://s1.sentry-cdn.com/content.js'
    );

    expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeTruthy();
  });

  describe('first-party stacks', () => {
    it('returns false when a frame comes from an asset chunk on the cdn', () => {
      const event = eventWithFrames(APP_CHUNK);

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when a frame comes from an asset on the page origin', () => {
      const event = eventWithFrames('https://sentry.io/_assets/app.abcdefg.js');

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when our own frames sit between anonymous ones', () => {
      const event = eventWithFrames(APP_CHUNK, '<anonymous>', APP_CHUNK);

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when only a chained error has a frame of ours', () => {
      const event = eventWithChainedFrames(['https://sentry.io/issues/'], [APP_CHUNK]);

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when a filename cannot be parsed as a url', () => {
      const event = eventWithFrames('http://');

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when the stack has no frames', () => {
      const event = {exception: {values: [{type: 'Error', value: 'Script error.'}]}};

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when the stack has an empty frame list', () => {
      const event = eventWithFrames();

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false for an asset stack under derived origins', () => {
      const event = eventWithFrames(APP_CHUNK);

      expect(
        isThirdPartyScriptEvent(event, getFirstPartyOrigins(DIST_PREFIX))
      ).toBeFalsy();
    });

    it('returns false for a customer domain asset alongside a document frame', () => {
      const event = eventWithFrames(
        'https://org-slug.sentry.io/_assets/app.js',
        'https://org-slug.sentry.io/issues/'
      );

      expect(isThirdPartyScriptEvent(event, [])).toBeFalsy();
    });

    it('returns false when the sdk loader appears alongside our code', () => {
      const event = eventWithFrames('https://js.sentry-cdn.com/loader.min.js', APP_CHUNK);

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when the exception has no values key', () => {
      const event = {exception: {}};

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when a stacktrace carries no frames', () => {
      const event = {exception: {values: [{stacktrace: {}}]}};

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when the exception has no values', () => {
      const event = {exception: {values: []}};

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when only one chained value carries a stacktrace', () => {
      const event = {
        exception: {
          values: [
            {type: 'Error', value: 'no stacktrace'},
            {
              stacktrace: {frames: [{filename: APP_CHUNK}]},
            },
          ],
        },
      };

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });

    it('returns false when the event has no exception', () => {
      const event = {message: 'Something happened'};

      expect(isThirdPartyScriptEvent(event, ORIGINS)).toBeFalsy();
    });
  });
});
