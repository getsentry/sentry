import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/java/feedback';

import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {sessionReplay} from './sessionReplay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: feedback,
  profilingOnboarding: profiling,
  replayOnboarding: sessionReplay,
  logsOnboarding: logs,
};

export default docs;
