import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {logs} from 'sentry/gettingStartedDocs/ruby/ruby/logs';
import {profiling} from 'sentry/gettingStartedDocs/ruby/ruby/profiling';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  profilingOnboarding: profiling({frameworkPackage: 'sentry-rails'}),
  logsOnboarding: logs({
    docsPlatform: 'rails',
  }),
};

export default docs;
