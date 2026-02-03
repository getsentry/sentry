import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/crashReport';
import {featureFlag} from 'sentry/gettingStartedDocs/python/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/python/logs';
import {mcp} from 'sentry/gettingStartedDocs/python/mcp';
import {metrics} from 'sentry/gettingStartedDocs/python/metrics';
import {profiling} from 'sentry/gettingStartedDocs/python/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding: profiling(),
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  feedbackOnboardingJsLoader,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: logs({
    packageName: 'sentry-sdk[tornado]',
  }),
  metricsOnboarding: metrics(),
};

export default docs;
