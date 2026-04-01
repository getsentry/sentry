import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};
