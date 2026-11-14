import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs,
};
