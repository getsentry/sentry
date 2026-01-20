import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/dotnet/feedback';
import {dotnetLogs} from 'sentry/gettingStartedDocs/dotnet/logs';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  logsOnboarding: dotnetLogs(),
};

export default docs;
