import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/apple-macos/crashReport';
import {profiling} from 'sentry/gettingStartedDocs/apple-macos/profiling';

import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {sessionReplay} from './sessionReplay';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};
