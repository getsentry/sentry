import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/go/crashReport';
import {logs} from 'sentry/gettingStartedDocs/go/logs';
import {onboarding} from 'sentry/gettingStartedDocs/go/onboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport({
    docsLink:
      'https://docs.sentry.io/platforms/go/user-feedback/configuration/#crash-report-modal',
  }),
  feedbackOnboardingJsLoader,
  logsOnboarding: logs({
    docsPlatform: 'go',
  }),
};

export default docs;
