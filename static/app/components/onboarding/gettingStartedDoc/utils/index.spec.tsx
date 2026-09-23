import {
  getJsDataCollectionDocsLink,
  isJavaScriptPlatform,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';

describe('isJavaScriptPlatform', () => {
  it.each([
    'javascript',
    'javascript-nextjs',
    'node',
    'node-express',
    'bun',
    'deno',
    'electron',
    'capacitor',
    'ionic',
  ])('accepts %s', platform => {
    expect(isJavaScriptPlatform(platform)).toBe(true);
  });

  it.each([
    'python',
    'python-fastapi',
    'php-laravel',
    'other',
    'go',
    // React Native is JavaScript-based, but its docs do not cover `dataCollection`.
    'react-native',
    undefined,
  ])('rejects %s', platform => {
    expect(isJavaScriptPlatform(platform)).toBe(false);
  });
});

describe('getJsDataCollectionDocsLink', () => {
  const BASE = 'https://docs.sentry.io/platforms/javascript';

  it.each([
    ['javascript-nextjs', `${BASE}/guides/nextjs/configuration/options/#dataCollection`],
    ['node', `${BASE}/guides/node/configuration/options/#dataCollection`],
    ['node-express', `${BASE}/guides/express/configuration/options/#dataCollection`],
    ['bun', `${BASE}/guides/bun/configuration/options/#dataCollection`],
    // Keys whose guide slug differs from the platform key
    ['node-awslambda', `${BASE}/guides/aws-lambda/configuration/options/#dataCollection`],
    [
      'node-azurefunctions',
      `${BASE}/guides/azure-functions/configuration/options/#dataCollection`,
    ],
    [
      'node-gcpfunctions',
      `${BASE}/guides/gcp-functions/configuration/options/#dataCollection`,
    ],
    [
      'node-cloudflare-workers',
      `${BASE}/guides/cloudflare/configuration/options/#dataCollection`,
    ],
    // Legacy key of the merged Cloudflare platform
    [
      'node-cloudflare-pages',
      `${BASE}/guides/cloudflare/configuration/options/#dataCollection`,
    ],
    ['ionic', `${BASE}/guides/capacitor/configuration/options/#dataCollection`],
  ])('maps %s to its guide', (platform, expected) => {
    expect(getJsDataCollectionDocsLink(platform)).toBe(expected);
  });

  it.each(['javascript', 'other', undefined])(
    'falls back to the canonical page for %s',
    platform => {
      expect(getJsDataCollectionDocsLink(platform)).toBe(
        `${BASE}/configuration/options/#dataCollection`
      );
    }
  );
});
