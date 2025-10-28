import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {getRubyProfilingOnboarding} from 'sentry/gettingStartedDocs/ruby/ruby';
import {getRubyLogsOnboarding} from 'sentry/utils/gettingStartedDocs/ruby';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  profilingOnboarding: getRubyProfilingOnboarding(),
  logsOnboarding: getRubyLogsOnboarding({
    docsPlatform: 'rails',
  }),
};

export default docs;
