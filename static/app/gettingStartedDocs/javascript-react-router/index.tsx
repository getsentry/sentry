import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profilingFullStack} from 'sentry/gettingStartedDocs/javascript/profiling';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  replayOnboarding: replay,
  feedbackOnboardingNpm: feedback,
  crashReportOnboarding: crashReport,
  performanceOnboarding: performance,
  profilingOnboarding: profilingFullStack({
    packageName: '@sentry/react-router',
    browserProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/browser-profiling/',
    nodeProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/node-profiling/',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logsFullStack({
    docsPlatform: 'react-router',
    packageName: '@sentry/react-router',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'react-router',
    packageName: '@sentry/react-router',
  }),
  mcpOnboarding: mcp,
};

export default docs;
