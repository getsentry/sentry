import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/dart/crashReport';

import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {sessionReplay} from './sessionReplay';
import {userFeedback} from './userFeedback';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: userFeedback,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};
