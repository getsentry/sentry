import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {dotnetLogs} from 'sentry/gettingStartedDocs/dotnet/logs';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: dotnetLogs(),
};

export default docs;
