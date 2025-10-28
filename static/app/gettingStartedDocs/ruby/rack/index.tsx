import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getRubyProfilingOnboarding} from 'sentry/gettingStartedDocs/ruby/ruby';
import {getRubyLogsOnboarding} from 'sentry/utils/gettingStartedDocs/ruby';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
  profilingOnboarding: getRubyProfilingOnboarding(),
  logsOnboarding: getRubyLogsOnboarding({
    docsPlatform: 'rack',
  }),
};

export default docs;
