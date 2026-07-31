import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {sessionReplay} from './sessionReplay';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  logsOnboarding: logs,
};
