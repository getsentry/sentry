import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/crashReport';
import {featureFlag} from 'sentry/gettingStartedDocs/python/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/python/logs';
import {metrics} from 'sentry/gettingStartedDocs/python/metrics';
import {profiling} from 'sentry/gettingStartedDocs/python/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  feedbackOnboardingJsLoader,
  profilingOnboarding: profiling(),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs(),
  metricsOnboarding: metrics(),
};

export default docs;
