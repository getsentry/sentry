import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {dotnetLogs} from 'sentry/gettingStartedDocs/dotnet/logs';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};

export default docs;
