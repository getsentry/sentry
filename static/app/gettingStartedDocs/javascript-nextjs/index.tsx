import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/featureFlag';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profilingFullStack} from 'sentry/gettingStartedDocs/javascript/profiling';
import {tct} from 'sentry/locale';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  profilingOnboarding: profilingFullStack({
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
  }),
  logsOnboarding: logsFullStack({
    docsPlatform: 'nextjs',
    packageName: '@sentry/nextjs',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'nextjs',
    packageName: '@sentry/nextjs',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
};

export default docs;
