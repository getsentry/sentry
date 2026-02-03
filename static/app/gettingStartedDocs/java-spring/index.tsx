import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {profiling} from 'sentry/gettingStartedDocs/java-spring/profiling';
import {feedback} from 'sentry/gettingStartedDocs/java/feedback';
import {metrics} from 'sentry/gettingStartedDocs/java/metrics';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {logs} from './logs';
import {onboarding} from './onboarding';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  crashReportOnboarding: feedback,
  replayOnboardingJsLoader,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
  profilingOnboarding: profiling,
};

export default docs;
