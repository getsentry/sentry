import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/java/feedback';

import {logs} from './logs';
import {onboarding} from './onboarding';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  platformOptions,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: feedback,
  onboarding,
  logsOnboarding: logs,
};

export default docs;
