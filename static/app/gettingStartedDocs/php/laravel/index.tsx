import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  replayOnboardingJsLoader,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
};

export default docs;
