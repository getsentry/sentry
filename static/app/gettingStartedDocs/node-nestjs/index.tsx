import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {featureFlag} from 'sentry/gettingStartedDocs/node/featureFlag';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  featureFlagOnboarding: featureFlag({
    packageName: '@sentry/nestjs',
  }),
  logsOnboarding: logs,
  metricsOnboarding: metrics,
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/nestjs',
  }),
  mcpOnboarding: mcp,
};
