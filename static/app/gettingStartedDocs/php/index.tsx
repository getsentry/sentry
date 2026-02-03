import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  performanceOnboarding: performance,
  profilingOnboarding: profiling,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};

export default docs;
