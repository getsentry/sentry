import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {replay} from './replay';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};
