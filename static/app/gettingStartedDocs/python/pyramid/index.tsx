import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {featureFlag} from 'sentry/gettingStartedDocs/python/python/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';
import {metrics} from 'sentry/gettingStartedDocs/python/python/metrics';
import {profiling} from 'sentry/gettingStartedDocs/python/python/profiling';

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
