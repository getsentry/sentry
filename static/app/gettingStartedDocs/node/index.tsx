import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {logs} from './logs';
import {mcp} from './mcp';
import {getNodeMetricsOnboarding} from './metrics';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  metricsOnboarding: getNodeMetricsOnboarding({
    docsPlatform: 'node',
    packageName: '@sentry/node',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
};

export default docs;
