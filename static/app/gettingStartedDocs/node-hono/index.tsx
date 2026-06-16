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
import {platformOptions, type PlatformOptions} from './utils';

export const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag(),
  logsOnboarding: logs,
  profilingOnboarding: profiling,
  agentMonitoringOnboarding: agentMonitoring(),
  mcpOnboarding: mcp,
  platformOptions,
  metricsOnboarding: metrics,
};
