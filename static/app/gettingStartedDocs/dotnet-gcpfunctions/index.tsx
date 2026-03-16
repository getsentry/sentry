import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/dotnet/feedback';
import {logs} from 'sentry/gettingStartedDocs/dotnet/logs';
import {metrics} from 'sentry/gettingStartedDocs/dotnet/metrics';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};

export default docs;
