import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {onboarding} from 'sentry/gettingStartedDocs/go-fiber/onboarding';
import {crashReport} from 'sentry/gettingStartedDocs/go/crashReport';
import {logs} from 'sentry/gettingStartedDocs/go/logs';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport({
    docsLink:
      'https://docs.sentry.io/platforms/go/guides/fiber/user-feedback/configuration/#crash-report-modal',
  }),
  feedbackOnboardingJsLoader,
  logsOnboarding: logs({
    docsPlatform: 'fiber',
  }),
};

export default docs;
