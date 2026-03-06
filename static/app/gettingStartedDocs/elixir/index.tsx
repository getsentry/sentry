import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/elixir/crashReport';
import {logs} from 'sentry/gettingStartedDocs/elixir/logs';
import {onboarding} from 'sentry/gettingStartedDocs/elixir/onboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs,
};

export default docs;
