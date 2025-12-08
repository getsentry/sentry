import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {logs} from 'sentry/gettingStartedDocs/ruby/logs';
import {profiling} from 'sentry/gettingStartedDocs/ruby/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
  profilingOnboarding: profiling(),
  logsOnboarding: logs({
    docsPlatform: 'rack',
  }),
};

export default docs;
