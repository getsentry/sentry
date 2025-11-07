import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/dotnet/dotnet/feedback';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
};

export default docs;
