import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logs} from 'sentry/gettingStartedDocs/dotnet/logs';
import {metrics} from 'sentry/gettingStartedDocs/dotnet/metrics';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};

export default docs;
