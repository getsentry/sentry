import {tct} from 'sentry/locale';
import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/nextjs',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/node-profiling/',
  getProfilingHeaderContent: () => [
    {
      type: 'text',
      text: tct(
        'In Next.js you can configure document response headers via the headers option in [code:next.config.js]:',
        {
          code: <code />,
        }
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'ESM',
          language: 'javascript',
          filename: 'next.config.js',
          code: `
export default withSentryConfig({
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      }],
    }];
  },
  // ... other Next.js config options
});`,
        },
        {
          label: 'CJS',
          language: 'javascript',
          filename: 'next.config.js',
          code: `
module.exports = withSentryConfig({
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      }],
    }];
  },
  // ... other Next.js config options
});`,
        },
      ],
    },
  ],
});
