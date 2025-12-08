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
  profilingOnboarding: profilingFullStack({
    packageName: '@sentry/sveltekit',
    browserProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/sveltekit/profiling/browser-profiling/',
    nodeProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/sveltekit/profiling/node-profiling/',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logsFullStack({
    docsPlatform: 'sveltekit',
    packageName: '@sentry/sveltekit',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'sveltekit',
    packageName: '@sentry/sveltekit',
  }),
  mcpOnboarding: mcp,
};

export default docs;
