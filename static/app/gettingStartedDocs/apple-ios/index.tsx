import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logs} from 'sentry/gettingStartedDocs/apple-ios/logs';
import {onboarding} from 'sentry/gettingStartedDocs/apple-ios/onboarding';
import {sessionReplay} from 'sentry/gettingStartedDocs/apple-ios/sessionReplay';
import {crashReport} from 'sentry/gettingStartedDocs/apple-macos/crashReport';
import {profiling} from 'sentry/gettingStartedDocs/apple-macos/profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
};

export default docs;
