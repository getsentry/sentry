import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/apple-macos/crashReport';
import {logs} from 'sentry/gettingStartedDocs/apple-macos/logs';
import {onboarding} from 'sentry/gettingStartedDocs/apple-macos/onboarding';
import {profiling} from 'sentry/gettingStartedDocs/apple-macos/profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
};

export default docs;
