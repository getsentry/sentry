import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedbackOnboardingCrashApiJava} from 'sentry/gettingStartedDocs/java/java';

import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {sessionReplay} from './sessionReplay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  profilingOnboarding: profiling,
  replayOnboarding: sessionReplay,
  logsOnboarding: logs,
};

export default docs;
