import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {dotnetLogs} from 'sentry/gettingStartedDocs/dotnet/logs';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: dotnetLogs(),
};

export default docs;
