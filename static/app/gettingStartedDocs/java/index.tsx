import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {feedback} from './feedback';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  platformOptions,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: feedback,
  logsOnboarding: logs,
  onboarding,
};

export default docs;
