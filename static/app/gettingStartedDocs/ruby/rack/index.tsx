import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getRubyLogsOnboarding} from 'sentry/utils/gettingStartedDocs/ruby';

import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
  profilingOnboarding: profiling,
  logsOnboarding: getRubyLogsOnboarding({
    docsPlatform: 'rack',
  }),
};

export default docs;
