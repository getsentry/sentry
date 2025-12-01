import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/featureFlag';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profilingFullStack} from 'sentry/gettingStartedDocs/javascript/profiling';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logsFullStack({
    docsPlatform: 'astro',
    packageName: '@sentry/astro',
  }),
  profilingOnboarding: profilingFullStack({
    packageName: '@sentry/astro',
    browserProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/browser-profiling/',
    nodeProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/node-profiling/',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'astro',
    packageName: '@sentry/astro',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
};

export default docs;
