import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding: profiling,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  metricsOnboarding: metrics,
};

export default docs;
